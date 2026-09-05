import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  CONVERSATION_SETTINGS_NAMESPACE, DEFAULT_BUSY_ENTER_BEHAVIOR, apply, Config,
} from '@deepseek-ai/dsh-client-ui-conversation'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-conversation host', () => {
  it('publishes product placeholder defaults through the settings base and accepts user overrides', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const inputPlaceholder = { zh: '输入内容，@ 技能、# 文件', en: 'Write here, @ skills, # files' }
    const heroPlaceholder = { zh: '开始创作', en: 'Start writing' }
    const fiber = ctx.plugin({ apply, Config }, { inputPlaceholder, heroPlaceholder })
    await fiber.await()
    const ns = CONVERSATION_SETTINGS_NAMESPACE
    expect(ctx.settings.get(ns)).toEqual({ busyEnter: 'queue', inputPlaceholder, heroPlaceholder })
    await ctx.settings.update(ns, { inputPlaceholder: { zh: '自定义', en: 'Custom' } })
    expect(ctx.settings.get(ns)).toEqual({
      busyEnter: 'queue', inputPlaceholder: { zh: '自定义', en: 'Custom' }, heroPlaceholder,
    })
    // @ts-expect-error Validate an incomplete configuration crossing the Loader boundary.
    expect(() => Config({ inputPlaceholder: { zh: '缺少英文' } })).toThrow()
    await expect(ctx.settings.update(ns, { heroPlaceholder: { zh: 123, en: 'Invalid' } })).rejects.toThrow()
    await fiber.dispose()
  })

  it('registers, validates, and disposes the durable busy-Enter preference', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = CONVERSATION_SETTINGS_NAMESPACE
    expect(ctx.settings.get(ns)).toEqual({ busyEnter: DEFAULT_BUSY_ENTER_BEHAVIOR })
    await ctx.settings.update(ns, { busyEnter: 'steer' })
    expect(ctx.settings.get(ns)).toEqual({ busyEnter: 'steer' })
    await expect(ctx.settings.update(ns, { busyEnter: 'invalid' })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })
})
