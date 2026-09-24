import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { ApiAuthorizationError, type ApiAuthorizationOperation } from '@deepseek-ai/dsh-api-operation-authorization'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { redactSecrets } from '@deepseek-ai/dsh-settings'
import { MemoryCredentials } from '../../../credentials/credentials/tests/memory.ts'
import SettingsController from '../src/index.ts'

/** In-memory settings double: the smallest provider surface the controller's
 * authorized-write path consumes (describe/update/replace/mutate plus a
 * per-namespace schema), standing in for the profile-driven SettingsForms,
 * which cannot be subclassed for fixtures. */
class MemorySettings {
  readonly writable = true
  readonly persisted: Array<{ ns: string; section: Record<string, unknown> }> = []
  private readonly schemas = new Map<string, Schema<never>>()
  private readonly values = new Map<string, Record<string, unknown>>()
  private readonly revisions = new Map<string, number>()

  constructor(ctx: Context) {
    ctx.provide('settings', this as never)
  }

  register<T>(ns: string, schema: Schema<T>): void {
    this.schemas.set(ns, schema as Schema<never>)
    this.values.set(ns, {})
    this.revisions.set(ns, 0)
  }

  describe(options?: { redactSecrets?: boolean }) {
    return [...this.schemas.entries()].map(([ns, schema]) => {
      const value = structuredClone(this.values.get(ns))
      const redacted = options?.redactSecrets === true
        ? redactSecrets(schema, value)
        : { value, secrets: [] }
      return {
        ns, autoGenerate: true, schema: schema.toJSON(), revision: this.revisions.get(ns),
        applies: 'live', value: redacted.value, secrets: redacted.secrets,
      }
    })
  }

  update(ns: string, patch: Record<string, unknown>, expectedRevision?: number): Promise<void> {
    return this.write(ns, current => ({ ...current, ...patch }), expectedRevision)
  }

  replace(ns: string, section: Record<string, unknown>, expectedRevision?: number): Promise<void> {
    return this.write(ns, () => section, expectedRevision)
  }

  mutate(
    ns: string,
    ops: readonly { op: 'set' | 'unset'; path: string[]; value?: unknown }[],
    expectedRevision?: number,
  ): Promise<void> {
    return this.write(
      ns,
      current => ops.reduce((section, op) => applyOp(section, op) as Record<string, unknown>, current),
      expectedRevision,
    )
  }

  private write(
    ns: string,
    change: (current: Record<string, unknown>) => Record<string, unknown>,
    expectedRevision?: number,
  ): Promise<void> {
    if (!this.schemas.has(ns)) return Promise.reject(new Error(`settings: unknown namespace "${ns}"`))
    const revision = this.revisions.get(ns) ?? 0
    if (expectedRevision !== undefined && expectedRevision !== revision) {
      return Promise.reject(new Error(`settings: revision conflict on "${ns}"`))
    }
    const section = change(structuredClone(this.values.get(ns) ?? {}))
    this.persisted.push({ ns, section: structuredClone(section) })
    this.values.set(ns, structuredClone(section))
    this.revisions.set(ns, revision + 1)
    return Promise.resolve()
  }
}

function applyOp(node: unknown, op: { op: 'set' | 'unset'; path: readonly string[]; value?: unknown }): unknown {
  const [key, ...rest] = op.path
  if (key === undefined) return node
  const clone: Record<string, unknown> | unknown[] = Array.isArray(node)
    ? [...node]
    : { ...(typeof node === 'object' && node !== null ? node : {}) }
  const child = rest.length === 0
    ? op.op === 'set' ? op.value : undefined
    : applyOp(Reflect.get(clone, key), { ...op, path: rest })
  if (rest.length === 0 && op.op === 'unset') Reflect.deleteProperty(clone, key)
  else Reflect.set(clone, key, child)
  return clone
}

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })

const Profile = Schema.object({
  title: Schema.string(),
  apiKey: Schema.string().role('secret'),
  routes: Schema.dict(Schema.object({ model: Schema.string(), token: Schema.string().role('secret') })),
  extras: Schema.array(Schema.object({ label: Schema.string(), password: Schema.string().role('secret') })),
})

async function fixture() {
  const ctx = new Context()
  contexts.push(ctx)
  const settings = new MemorySettings(ctx)
  settings.register('writerx-models', Profile)
  const credentials = new MemoryCredentials(ctx)
  const llm = new LlmRuntime(ctx)
  await ctx.plugin(SettingsController)
  return { ctx, settings, credentials, llm, controller: ctx.settingsController }
}

const refusal = () => new ApiAuthorizationError({ code: 'MEMBERSHIP_REQUIRED', message: 'Membership is required.', details: { action: 'upgrade' } })

describe('authorization in the actual configuration Remote owners', () => {
  it.each(['update', 'replace', 'mutate'] as const)('denies settings.%s before any persistence', async (method) => {
    const f = await fixture()
    const seen: ApiAuthorizationOperation[] = []
    f.ctx.on('api/authorize-operation', async (operation) => {
      seen.push(operation)
      await Promise.resolve()
      throw refusal()
    })
    const request = method === 'mutate'
      ? f.controller.mutate('writerx-models', [{ op: 'set', path: ['apiKey'], value: 'sk-secret' }], undefined)
      : f.controller[method]('writerx-models', { title: 'chosen', apiKey: 'sk-secret' }, undefined)
    const error = await request.catch((error: unknown) => error)
    expect(remoteErrorOf(error)).toMatchObject({
      code: 'api/operation-denied', message: 'Membership is required.',
      details: { reasonCode: 'MEMBERSHIP_REQUIRED', reasonDetails: { action: 'upgrade' }, retryable: false },
    })
    expect(f.settings.persisted).toEqual([])
    expect(JSON.stringify(seen)).not.toContain('sk-secret')
    expect(seen[0]?.method).toBe(`settings.${method}`)
  })

  it('redacts nested secret fields while descriptor mutations cannot change the stored request', async () => {
    const f = await fixture()
    const seen: ApiAuthorizationOperation[] = []
    f.ctx.on('api/authorize-operation', (operation) => {
      seen.push(structuredClone(operation))
      if (operation.method !== 'settings.update') return
      const patch = operation.payload.patch as { title: string; routes: { route: { model: string } } }
      patch.title = 'policy replacement'
      patch.routes.route.model = 'wrong-model'
    })
    const request = { title: 'original', apiKey: 'sk-root', routes: { route: { model: 'selected', token: 'sk-route' } }, extras: [{ label: 'public', password: 'sk-array' }] }
    await f.controller.update('writerx-models', request, 0)
    expect(seen).toEqual([{
      method: 'settings.update', payload: {
        ns: 'writerx-models', expectedRevision: 0,
        patch: { title: 'original', routes: { route: { model: 'selected' } }, extras: [{ label: 'public' }] },
      },
    }])
    expect(f.settings.persisted[0]?.section).toEqual(request)
    expect(request.routes.route.model).toBe('selected')
  })

  it('keeps mutation paths but hides direct secret values and secret descendants', async () => {
    const f = await fixture()
    const seen: ApiAuthorizationOperation[] = []
    f.ctx.on('api/authorize-operation', (operation) => { seen.push(operation); throw refusal() })
    await expect(f.controller.mutate('writerx-models', [
      { op: 'set', path: ['apiKey'], value: 'sk-root' },
      { op: 'set', path: ['routes', 'route'], value: { model: 'chosen', token: 'sk-route' } },
      { op: 'set', path: ['extras', '0', 'password'], value: 'sk-array' },
      { op: 'unset', path: ['routes', 'old'] },
    ], 7)).rejects.toThrow()
    expect(seen[0]).toEqual({ method: 'settings.mutate', payload: {
      ns: 'writerx-models', expectedRevision: 7, ops: [
        { op: 'set', path: ['apiKey'] },
        { op: 'set', path: ['routes', 'route'], value: { model: 'chosen' } },
        { op: 'set', path: ['extras', '0', 'password'] },
        { op: 'unset', path: ['routes', 'old'] },
      ],
    } })
    expect(f.settings.persisted).toEqual([])
  })

  it('omits values from an unregistered settings namespace', async () => {
    const f = await fixture()
    const seen: ApiAuthorizationOperation[] = []
    f.ctx.on('api/authorize-operation', (operation) => { seen.push(operation); throw refusal() })
    await expect(f.controller.replace('unknown', { arbitrary: 'sk-unknown' }, undefined)).rejects.toThrow()
    expect(seen).toEqual([{ method: 'settings.replace', payload: { ns: 'unknown', section: {} } }])
  })

  it('withholds a union branch containing a secret from authorization metadata', async () => {
    const f = await fixture()
    f.settings.register('union-profile', Schema.object({ config: Schema.union([
      Schema.object({ kind: Schema.const('a'), token: Schema.string().role('secret') }),
      Schema.object({ kind: Schema.const('b'), label: Schema.string() }),
    ]) }))
    const seen: ApiAuthorizationOperation[] = []
    f.ctx.on('api/authorize-operation', (operation) => { seen.push(operation); throw refusal() })
    await expect(f.controller.update('union-profile', { config: { kind: 'a', token: 'sk-union' } }, undefined)).rejects.toThrow()
    expect(JSON.stringify(seen)).not.toContain('sk-union')
    expect(f.settings.persisted).toEqual([])
  })

  it('denies credential writes before the store and exposes only the reference', async () => {
    const f = await fixture()
    await f.credentials.set(credentialRef('API_KEY'), 'sk-existing')
    const set = vi.spyOn(f.credentials, 'set')
    const unset = vi.spyOn(f.credentials, 'unset')
    const seen: ApiAuthorizationOperation[] = []
    f.ctx.on('api/authorize-operation', (operation) => { seen.push(operation); throw refusal() })
    await expect(f.ctx.credentialsController.set('API_KEY', 'sk-proposed')).rejects.toThrow('Membership is required.')
    await expect(f.ctx.credentialsController.unset('API_KEY')).rejects.toThrow('Membership is required.')
    expect(set).not.toHaveBeenCalled()
    expect(unset).not.toHaveBeenCalled()
    expect(seen).toEqual([
      { method: 'credentials.set', payload: { ref: 'API_KEY' } },
      { method: 'credentials.unset', payload: { ref: 'API_KEY' } },
    ])
    expect((await f.credentials.resolve(credentialRef('API_KEY')))?.value).toBe('sk-existing')
  })

  it('keeps the actual credential target independent from policy descriptor changes', async () => {
    const f = await fixture()
    f.ctx.on('api/authorize-operation', (operation) => {
      if (operation.method === 'credentials.set') operation.payload.ref = 'WRONG_KEY'
    })
    await f.ctx.credentialsController.set('API_KEY', 'sk-proposed')
    expect((await f.credentials.resolve(credentialRef('API_KEY')))?.value).toBe('sk-proposed')
    expect(await f.credentials.resolve(credentialRef('WRONG_KEY'))).toBeUndefined()
  })

  it('denies model discovery before network work and never shares its one-shot API key', async () => {
    const f = await fixture()
    const discover = vi.fn(async () => [{ id: 'candidate' }])
    f.llm.registerModelDiscovery('llm-test', discover)
    const seen: ApiAuthorizationOperation[] = []
    f.ctx.on('api/authorize-operation', (operation) => { seen.push(operation); throw refusal() })
    await expect(f.llm.remoteDiscoverModels('llm-test', {
      baseURL: 'https://provider.example/v1', api: 'openai-completions', apiKey: 'sk-draft',
    }, new AbortController().signal)).rejects.toThrow('Membership is required.')
    expect(discover).not.toHaveBeenCalled()
    expect(seen).toEqual([{ method: 'llm.discoverModels', payload: {
      settingsNs: 'llm-test', baseURL: 'https://provider.example/v1', api: 'openai-completions',
    } }])
  })

  it('policy changes cannot redirect an approved discovery request', async () => {
    const f = await fixture()
    const discover = vi.fn(async () => [{ id: 'candidate' }])
    f.llm.registerModelDiscovery('llm-test', discover)
    f.ctx.on('api/authorize-operation', (operation) => {
      if (operation.method === 'llm.discoverModels') operation.payload.baseURL = 'https://wrong.example/v1'
    })
    const request = { baseURL: 'https://provider.example/v1', apiKey: 'sk-draft' }
    const signal = new AbortController().signal
    expect(await f.llm.remoteDiscoverModels('llm-test', request, signal)).toEqual([{ id: 'candidate' }])
    expect(discover).toHaveBeenCalledWith(request, signal)
    expect(request.baseURL).toBe('https://provider.example/v1')
  })

  it.each(['settings', 'credentials', 'discovery'] as const)('maps an unexpected %s policy failure to one safe reason', async (operation) => {
    const f = await fixture()
    const discover = vi.fn(async () => [])
    f.llm.registerModelDiscovery('llm-test', discover)
    f.ctx.on('api/authorize-operation', () => { throw new Error('internal response sk-leaked-secret') })
    const result = operation === 'settings'
      ? f.controller.update('writerx-models', { title: 'chosen' }, undefined)
      : operation === 'credentials'
        ? f.ctx.credentialsController.set('API_KEY', 'sk-request')
        : f.llm.remoteDiscoverModels('llm-test', { provider: 'draft' }, new AbortController().signal)
    const error = await result.catch((error: unknown) => error)
    expect(remoteErrorOf(error)).toMatchObject({
      code: 'api/operation-denied',
      message: 'Unable to confirm permission for this operation. Please refresh and try again.',
      details: { reasonCode: 'AUTHORIZATION_UNAVAILABLE', retryable: false },
    })
    expect(JSON.stringify(remoteErrorOf(error))).not.toContain('sk-')
    expect(f.settings.persisted).toEqual([])
    expect(discover).not.toHaveBeenCalled()
  })
})
