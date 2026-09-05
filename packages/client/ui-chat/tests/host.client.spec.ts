import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import * as ChatHost from '../src/index.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('Chat Host presentation defaults', () => {
  it.each([true, false])('publishes metric visibility %s through the existing settings namespace', async (showTurnMetrics) => {
    const ctx = new Context()
    try {
      await ctx.plugin(MemorySettings).await()
      await ctx.plugin(ChatHost, { showTurnMetrics }).await()
      const descriptor = ctx.settings.describe().find(row => row.ns === ChatHost.CHAT_SETTINGS_NAMESPACE)
      expect(descriptor?.base).toEqual({ showTurnMetrics })
      expect(descriptor?.value).toEqual({ transcriptView: 'compact', showTurnMetrics })
      await ctx.settings.update(ChatHost.CHAT_SETTINGS_NAMESPACE, { transcriptView: 'normal' })
      expect(ctx.settings.get(ChatHost.CHAT_SETTINGS_NAMESPACE)).toEqual({ transcriptView: 'normal', showTurnMetrics })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('retains enabled metrics as the official composition default', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(MemorySettings).await()
      await ctx.plugin(ChatHost).await()
      expect(ctx.settings.get(ChatHost.CHAT_SETTINGS_NAMESPACE)).toEqual({
        transcriptView: 'compact', showTurnMetrics: true,
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
