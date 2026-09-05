/** Host registration for browser Chat preferences. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { CHAT_SETTINGS_NAMESPACE, ChatSettingsSchema } from './chat-settings.ts'
import { Config } from './presentation-config.ts'
export { Config } from './presentation-config.ts'

export {
  CHAT_SETTINGS_NAMESPACE, DEFAULT_TRANSCRIPT_VIEW_MODE, TRANSCRIPT_VIEW_FIELD,
  TRANSCRIPT_VIEW_MODES, type ChatSettings, type TranscriptViewMode,
} from './chat-settings.ts'

/**
 * Register the durable Chat settings section when a provider exists.
 * @param ctx - Host context owning settings registration.
 * @param config - Composition-owned presentation defaults published through settings.
 */
export function apply(ctx: Context, config: Config = Config({})): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      CHAT_SETTINGS_NAMESPACE,
      ChatSettingsSchema,
      { base: { showTurnMetrics: config.showTurnMetrics ?? true } },
    )
  })
}
