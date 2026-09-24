import { describe, expect, it } from 'vitest'
import { assertServiceable, Config, resolveProfiles, type Options } from '../src/config.ts'

/** Validate one hand-declared route, with the caller's fields layered onto it. */
const routeWith = (profile: Record<string, unknown>): (() => unknown) =>
  () => ({ providers: Config({
    providers: {
      'acme-gateway': {
        api: 'openai-completions',
        baseURL: 'https://acme.test',
        models: [{ id: 'm' }],
        ...profile,
      },
    },
  }).providers.get() })

/** Validate that route with the caller's fields on its single model entry. */
const configWith = (model: Record<string, unknown>): (() => unknown) =>
  routeWith({ models: [{ id: 'm', ...model }] })

describe('reasoning schema boundary', () => {
  it('captures detached string annotations for model entries and catalog overrides', () => {
    const metadata = { purpose: 'display-only' }
    const raw = routeWith({ models: [{ id: 'm', metadata }] })() as Options
    const resolved = resolveProfiles(raw.providers ?? {})
    expect(resolved.get('acme-gateway')?.modelMetadata.get('m')).toEqual(metadata)
    // The parsed snapshot itself is frozen at the volatile seam, so detachment
    // is proven against the caller-held literal: later edits must not reach
    // the resolved projection.
    metadata.purpose = 'later'
    expect(resolved.get('acme-gateway')?.modelMetadata.get('m')?.purpose).toBe('display-only')
    const overridden = resolveProfiles({ deepseek: { modelOverrides: { 'deepseek-v4-flash': { metadata } } } })
    expect(overridden.get('deepseek')?.modelMetadata.get('deepseek-v4-flash')).toEqual(metadata)
    expect(configWith({ metadata: { invalid: 123 } })).toThrow()
  })
  it('accepts an empty provider section and propagates unexpected catalog failures', () => {
    expect(() => { assertServiceable({}) }).not.toThrow()
    const failure = new TypeError('model metadata lookup failed')
    expect(() => resolveProfiles({ openrouter: { models: [{
      id: '111',
      get name(): string { throw failure },
    }], api: 'openai-completions' } }, 'deferred')).toThrow(failure)
  })

  it('rejects a level pi-ai does not know at the write that produced it', () => {
    expect(configWith({ reasoningEfforts: { ultra: 'x' } })).toThrow(/"off"/)
    expect(configWith({ reasoningEfforts: { high: 42 } })).toThrow()
  })

  it('keeps false distinguishable from an absent declaration', () => {
    type Materialized = { providers: Record<string, { models?: { reasoningEfforts?: unknown }[] }> }
    const withFalse = configWith({ reasoningEfforts: false })() as Materialized
    expect(withFalse.providers['acme-gateway']?.models?.[0]?.reasoningEfforts).toBe(false)
    const absent = configWith({})() as Materialized
    expect(absent.providers['acme-gateway']?.models?.[0]?.reasoningEfforts).toBeUndefined()
  })

  it('rejects a thinking format outside the offered set', () => {
    expect(configWith({ compat: { thinkingFormat: 'quantum' } })).toThrow(/expected/)
  })

  it('accepts Baseten template arguments and completion controls', () => {
    expect(configWith({
      compat: {
        supportsFinishReason: false,
        thinkingFormat: 'baseten',
        chatTemplateArgs: { enable_thinking: { $var: 'thinking.enabled' } },
        supportsThinkingTokenBudget: true,
      },
    })).not.toThrow()
  })
})

describe('modality schema boundary', () => {
  it('rejects a modality pi-ai does not know, at either level', () => {
    expect(configWith({ input: ['audio'] })).toThrow(/expected/)
    expect(routeWith({ defaultInput: ['text', 'audio'] })).toThrow(/expected/)
  })

  it('refuses a route whose models could accept nothing', () => {
    // The pair the settings seam runs: the schema accepts the empty list as
    // well-typed, and the namespace validator is what refuses it. Asserting
    // only the schema would report this route as writable.
    expect(routeWith({ defaultInput: [] })).not.toThrow()
    expect(() => { assertServiceable(routeWith({ defaultInput: [] })() as Options) })
      .toThrow(/defaultInput must name at least one modality/)
  })

  type Materialized = {
    providers: Record<string, { defaultInput?: unknown; models?: { input?: unknown }[] }>
  }

  it('materializes an absent entry list as empty and an absent route list as text', () => {
    // The empty-list inheritance rule exists because of exactly this: an entry
    // that declares nothing reaches resolution as `[]`, not as `undefined`.
    const absent = configWith({})() as Materialized
    expect(absent.providers['acme-gateway']?.models?.[0]?.input).toEqual([])
    expect(absent.providers['acme-gateway']?.defaultInput).toEqual(['text'])
  })
})

describe('model presentation schema boundary', () => {
  it('retains serviceable model labels and explicit output caps beside deferred catalog errors', () => {
    const providers = {
      'acme-gateway': {
        api: 'openai-completions' as const,
        baseURL: 'https://acme.test',
        models: [
          { id: 'member', maxTokens: 80_000, presentation: { sectionId: 'premium', sectionName: 'Premium' } },
          { id: 'broken', presentation: { sectionId: '', sectionName: 'Broken' } },
        ],
      },
    }
    const profile = resolveProfiles(providers, 'deferred').get('acme-gateway')
    expect(profile?.piProvider?.getModels().map(model => model.id)).toEqual(['member'])
    expect(profile?.configuredMaxTokens.get('member')).toBe(80_000)
    expect(profile?.modelPresentations.get('member')).toEqual({ sectionId: 'premium', sectionName: 'Premium' })
    expect(profile?.modelErrors.get('broken')).toMatch(/sectionId/)
    expect(() => resolveProfiles(providers)).toThrow(/sectionId/)
  })

  it('accepts a complete selector-only section and preserves omission', () => {
    type Materialized = { providers: Record<string, { models?: { presentation?: unknown }[] }> }
    const configured = configWith({
      presentation: { sectionId: 'premium', sectionName: 'Premium', sectionOrder: 20 },
    })() as Materialized
    expect(configured.providers['acme-gateway']?.models?.[0]?.presentation).toEqual({
      sectionId: 'premium', sectionName: 'Premium', sectionOrder: 20,
    })
    const absent = configWith({})() as Materialized
    expect(absent.providers['acme-gateway']?.models?.[0]?.presentation).toBeUndefined()
  })

  it('rejects an incomplete section at service resolution', () => {
    expect(() => {
      assertServiceable(configWith({ presentation: { sectionId: 'premium' } })() as Options)
    }).toThrow(/sectionName/)
    expect(() => {
      assertServiceable(configWith({ presentation: { sectionName: 'Premium' } })() as Options)
    }).toThrow(/sectionId/)
  })
})

describe('request image policy bounds', () => {
  it.each([
    ['requestImagePixelBudget', 0, /requestImagePixelBudget must be a positive safe integer/],
    ['requestImagePixelBudget', Number.MAX_SAFE_INTEGER + 1, /requestImagePixelBudget must be a positive safe integer/],
    ['requestImageMaxBytes', 0, /requestImageMaxBytes must be a positive safe integer/],
    ['requestImageMaxBytes', 1.5, /requestImageMaxBytes must be a positive safe integer/],
  ] as const)('rejects %s=%s at service resolution', (field, value, message) => {
    const programmatic = {
      providers: {
        'acme-gateway': {
          api: 'openai-completions',
          baseURL: 'https://acme.test',
          models: [{ id: 'm' }],
          [field]: value,
        },
      },
    } as Options
    expect(() => {
      assertServiceable(programmatic)
    }).toThrow(message)
  })
})
