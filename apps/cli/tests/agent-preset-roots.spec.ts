import { describe, expect, it } from 'vitest'
import { resolveAgentPresetsPatch } from '../src/profile-boot.ts'

const SHIPPED = '/install/apps/cli/config/agent-presets/'

describe('resolveAgentPresetsPatch', () => {
  it('appends the shipped root to a row that configures none (the shipped bundles)', () => {
    expect(resolveAgentPresetsPatch({ id: 'agent-presets', name: '@deepseek-ai/dsh-agent-presets', config: { default: 'standard' } }, SHIPPED)).toEqual({
      id: 'agent-presets',
      config: { default: 'standard', roots: [{ path: SHIPPED, trust: 'system' }] },
    })
  })

  it('keeps the composition roots first, verbatim and in order, and appends the shipped root after them', () => {
    const row = {
      id: 'agent-presets',
      name: '@deepseek-ai/dsh-agent-presets',
      config: {
        default: 'mine',
        roots: [
          { path: '/deploy/presets', trust: 'system' },
          { path: '/deploy/extra' },
        ],
        includeUserRoot: true,
      },
    }
    expect(resolveAgentPresetsPatch(row, SHIPPED)).toEqual({
      id: 'agent-presets',
      config: {
        default: 'mine',
        includeUserRoot: true,
        roots: [
          { path: '/deploy/presets', trust: 'system' },
          { path: '/deploy/extra' },
          { path: SHIPPED, trust: 'system' },
        ],
      },
    })
  })

  it('carries a `!!js` root path through untouched — the Loader evaluates it when the row mounts', () => {
    const jsRoot = { path: { __jsExpr: "dshHomePath('profiles/x/node_modules/pkg/presets')" }, trust: 'system' }
    const row = { id: 'agent-presets', name: '@deepseek-ai/dsh-agent-presets', config: { default: 'mine', roots: [jsRoot] } }
    expect(resolveAgentPresetsPatch(row, SHIPPED)?.config).toEqual({
      default: 'mine',
      roots: [jsRoot, { path: SHIPPED, trust: 'system' }],
    })
  })

  it('leaves the shipped root out when the row opts out, and strips the launcher-only key', () => {
    const row = {
      id: 'agent-presets',
      name: '@deepseek-ai/dsh-agent-presets',
      config: { default: 'mine', roots: [{ path: '/deploy/presets', trust: 'system' }], includeShippedRoot: false },
    }
    const patch = resolveAgentPresetsPatch(row, SHIPPED)
    expect(patch).toEqual({
      id: 'agent-presets',
      config: { default: 'mine', roots: [{ path: '/deploy/presets', trust: 'system' }] },
    })
    expect(patch?.config).not.toHaveProperty('includeShippedRoot')
  })

  it('does not append the shipped root twice when the composition already names it', () => {
    const row = { id: 'agent-presets', name: '@deepseek-ai/dsh-agent-presets', config: { default: 'standard', roots: [{ path: SHIPPED, trust: 'system' }] } }
    expect(resolveAgentPresetsPatch(row, SHIPPED)?.config).toEqual({
      default: 'standard',
      roots: [{ path: SHIPPED, trust: 'system' }],
    })
  })

  it('drops entries that are not objects and leaves shape and defaults to the roster schema', () => {
    const row = { id: 'agent-presets', name: '@deepseek-ai/dsh-agent-presets', config: { default: 'x', roots: ['nope', 7, { path: '/p' }] } }
    expect(resolveAgentPresetsPatch(row, SHIPPED)?.config).toEqual({
      default: 'x',
      roots: [{ path: '/p' }, { path: SHIPPED, trust: 'system' }],
    })
  })

  it('generates nothing for a composition without the roster row', () => {
    expect(resolveAgentPresetsPatch(undefined, SHIPPED)).toBeUndefined()
  })
})
