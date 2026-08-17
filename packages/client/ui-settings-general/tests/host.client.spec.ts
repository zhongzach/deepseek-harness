import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply, Config } from '../src/index.ts'

/** Mirrors the module-local namespace id in src/index.ts. */
const ONBOARDING_SETTINGS_NAMESPACE = 'ui-onboarding'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-settings-general host', () => {
  it('registers and disposes the durable onboarding namespace with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    expect(ctx.settings.describe().map(row => row.ns)).toContain(
      settingsNamespace(ONBOARDING_SETTINGS_NAMESPACE),
    )
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(
      settingsNamespace(ONBOARDING_SETTINGS_NAMESPACE),
    )
  })

  it('lands the composition welcome-notice switch in the namespace base layer (default on)', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    await ctx.plugin({ apply }).await()
    const ns = settingsNamespace(ONBOARDING_SETTINGS_NAMESPACE)
    const row = ctx.settings.describe().find(candidate => candidate.ns === ns)
    expect(row?.base).toEqual({ welcomeNotice: true })
    expect((row?.value as { welcomeNotice?: boolean }).welcomeNotice).toBe(true)
  })

  it('lets a composition switch the welcome notice off through its config', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    await ctx.plugin({ apply, Config }, { welcomeNotice: false }).await()
    const ns = settingsNamespace(ONBOARDING_SETTINGS_NAMESPACE)
    const row = ctx.settings.describe().find(candidate => candidate.ns === ns)
    expect(row?.base).toEqual({ welcomeNotice: false })
    expect((row?.value as { welcomeNotice?: boolean }).welcomeNotice).toBe(false)
  })
})
