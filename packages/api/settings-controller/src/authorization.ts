/** Schema-aware redaction performed before configuration policy sees a write. */
import Schema from '@deepseek-ai/schemastery'
import { redactSecrets } from '@deepseek-ai/dsh-settings'
import type { SettingsDescriptor } from '@deepseek-ai/dsh-settings'
import type { ApiAuthorizationOperation } from '@deepseek-ai/dsh-api-operation-authorization'

function children(schema: Schema<never>): Schema<never>[] {
  return [
    ...Object.values(schema.dict ?? {}),
    ...(schema.list ?? []),
    ...(schema.inner === undefined ? [] : [schema.inner]),
  ] as Schema<never>[]
}

function declaresSecret(schema: Schema<never>): boolean {
  return schema.meta.role === 'secret' || children(schema).some(declaresSecret)
}

/** Withhold compound branches the shared structural redactor cannot safely inspect. */
function protectCompoundSecrets(schema: Schema<never>): void {
  if (!['object', 'dict', 'array'].includes(schema.type)) {
    if (declaresSecret(schema)) schema.meta = { ...schema.meta, role: 'secret' }
    return
  }
  for (const child of children(schema)) protectCompoundSecrets(child)
}

/** A withheld branch still names the submitted properties that policy must protect. */
function presenceOnly(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(presenceOnly)
  if (typeof value !== 'object' || value === null) return undefined
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, presenceOnly(entry)]))
}

function redactWithPresence(schema: Schema<never>, input: unknown): unknown {
  const redacted = redactSecrets(schema, input)
  if (redacted.secrets.some(secret => secret.set && secret.path.length === 0)) return presenceOnly(input)
  for (const secret of redacted.secrets) {
    const lastKey = secret.path.at(-1)
    if (!secret.set || lastKey === undefined) continue
    let target = redacted.value
    let source = input
    for (const key of secret.path.slice(0, -1)) {
      if (typeof target !== 'object' || target === null) break
      target = Reflect.get(target, key)
      source = typeof source === 'object' && source !== null ? Reflect.get(source, key) : undefined
    }
    if (typeof target === 'object' && target !== null) {
      const value = typeof source === 'object' && source !== null ? presenceOnly(Reflect.get(source, lastKey)) : undefined
      Object.defineProperty(target, lastKey, { value, enumerable: true, writable: true, configurable: true })
    }
  }
  return redacted.value
}

/** Resolve the schema at one path; a secret ancestor keeps its descendants secret. */
function schemaAtPath(schema: Schema<never>, path: readonly string[]): Schema<never> | undefined {
  let node: Schema<never> | undefined = schema
  for (const key of path) {
    if (node?.meta.role === 'secret') return node
    if (node?.type === 'object') node = node.dict?.[key] as Schema<never> | undefined
    else if (node?.type === 'dict' || node?.type === 'array') node = node.inner as Schema<never> | undefined
    else return undefined
  }
  return node
}

/**
 * Remove schema-declared settings secrets before policy sees a request, preserving mutation paths.
 * @param descriptor - registered settings schema, absent for an unknown namespace.
 * @param operation - the proposed settings write, before persistence.
 * @returns detached metadata suitable for authorization.
 */
export function redactSettingsOperation(
  descriptor: SettingsDescriptor | undefined,
  operation: Extract<ApiAuthorizationOperation, { method: 'settings.update' | 'settings.replace' | 'settings.mutate' }>,
): ApiAuthorizationOperation {
  const detached = structuredClone(operation)
  if (descriptor === undefined) {
    // Unknown namespaces cannot persist; do not disclose arbitrary submitted values to listeners.
    if (detached.method === 'settings.update') detached.payload.patch = {}
    else if (detached.method === 'settings.replace') detached.payload.section = {}
    else detached.payload.ops = detached.payload.ops.map(op => ({ op: op.op, path: op.path }))
    return detached
  }
  const schema = new Schema<never>(structuredClone(descriptor.schema) as Partial<Schema<never>>)
  protectCompoundSecrets(schema)
  if (detached.method === 'settings.update') {
    detached.payload.patch = (redactWithPresence(schema, detached.payload.patch) ?? {}) as object
  } else if (detached.method === 'settings.replace') {
    detached.payload.section = (redactWithPresence(schema, detached.payload.section) ?? {}) as object
  } else {
    detached.payload.ops = detached.payload.ops.map((op) => {
      if (op.op === 'unset') return op
      const node = schemaAtPath(schema, op.path)
      const value = node === undefined ? undefined : redactWithPresence(node, op.value)
      return { op: 'set', path: op.path, ...value === undefined ? {} : { value } }
    })
  }
  return detached
}
