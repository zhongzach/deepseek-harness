/** Deployment-owned authorization for model selection and configuration operations. */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { redactSecrets } from '@deepseek-ai/dsh-settings'
import type { SettingsDescriptor } from '@deepseek-ai/dsh-settings'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ModelCatalogFailure, ModelProviderGroup, ModelSelection } from './api/index.ts'
import type { RpcError } from './api/rpc.ts'

/** A path edit exposed to authorization; secret values are absent, but their paths remain visible. */
export type SettingsAuthorizationPathOp =
  | { op: 'set'; path: readonly string[]; value?: unknown }
  | { op: 'unset'; path: readonly string[] }

/** Operation name to non-secret authorization payload; deployments may extend this map. */
export interface ApiAuthorizationOperationMap {
  'sessions.selectModel': ModelSelection & { sessionId: SessionId }
  'settings.update': { ns: string; patch: object; expectedRevision?: number }
  'settings.replace': { ns: string; section: object; expectedRevision?: number }
  'settings.mutate': { ns: string; ops: SettingsAuthorizationPathOp[]; expectedRevision?: number }
  'credentials.set': { ref: string }
  'credentials.unset': { ref: string }
  'llm.discoverModels': { settingsNs: string; provider?: string; baseURL?: string; api?: string }
}

/** One detached operation descriptor; listeners cannot rewrite the submitted operation. */
export type ApiAuthorizationOperation = {
  [K in keyof ApiAuthorizationOperationMap]: { method: K; payload: ApiAuthorizationOperationMap[K] }
}[keyof ApiAuthorizationOperationMap]

/** Detached model catalog decorated before either catalog API publishes it. */
export interface ApiModelCatalog {
  groups: ModelProviderGroup[]
  failures: ModelCatalogFailure[]
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Authorize an operation before selection, persistence, or provider discovery starts.
     * A listener returns void to continue and throws to refuse; deployments own all policy.
     * @mode serial
     * @param operation - detached request metadata with credential and schema-secret values omitted.
     */
    'api/authorize-operation'(operation: ApiAuthorizationOperation): void | Promise<void>
    /**
     * Decorate selectable model rows without changing model routing or executing a request.
     * @mode serial
     * @param catalog - detached catalog whose availability fields may be populated by deployment policy.
     */
    'api/model-catalog'(catalog: ApiModelCatalog): void | Promise<void>
  }
}

/** A safe, non-retryable authorization refusal exposed without becoming a provider failure. */
export class ApiAuthorizationError extends Error {
  /** Deployment-owned reason preserved in the wire refusal. */
  readonly code: string
  /** Optional public-safe details; never include credentials or upstream response bodies. */
  readonly details: Record<string, unknown> | undefined

  constructor(error: { code: string; message: string; details?: Record<string, unknown> }) {
    super(error.message)
    this.name = 'ApiAuthorizationError'
    this.code = error.code
    this.details = error.details
  }
}

/**
 * Run every authorization listener before its executor; unexpected failures also refuse the operation.
 * @param ctx - owning Host context.
 * @param operation - non-secret descriptor of the pending operation.
 * @returns the wire refusal, or undefined when every listener accepts.
 */
export async function authorizeApiOperation(ctx: Context, operation: ApiAuthorizationOperation): Promise<RpcError | undefined> {
  try {
    await ctx.serial('api/authorize-operation', structuredClone(operation))
    return undefined
  } catch (error: unknown) {
    if (error instanceof ApiAuthorizationError) {
      return {
        code: 'operation-denied',
        message: error.message,
        details: {
          reasonCode: error.code,
          retryable: false,
          ...error.details === undefined ? {} : { reasonDetails: error.details },
        },
      }
    }
    return {
      code: 'operation-denied',
      message: 'Unable to confirm permission for this operation. Please refresh and try again.',
      details: { reasonCode: 'AUTHORIZATION_UNAVAILABLE', retryable: false },
    }
  }
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
  const schema = new Schema<never>(descriptor.schema as Partial<Schema<never>>)
  if (detached.method === 'settings.update') {
    detached.payload.patch = redactSecrets(schema, detached.payload.patch).value ?? {}
  } else if (detached.method === 'settings.replace') {
    detached.payload.section = redactSecrets(schema, detached.payload.section).value ?? {}
  } else {
    detached.payload.ops = detached.payload.ops.map((op) => {
      if (op.op === 'unset') return op
      const node = schemaAtPath(schema, op.path)
      const value = node === undefined ? undefined : redactSecrets(node, op.value).value
      return { op: 'set', path: op.path, ...value === undefined ? {} : { value } }
    })
  }
  return detached
}
