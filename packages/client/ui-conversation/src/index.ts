/** Host registration for browser conversation preferences. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-settings'
import {
  CONVERSATION_SETTINGS_NAMESPACE, ConversationSettingsSchema, LocalizedPlaceholderSchema,
  type LocalizedPlaceholder,
} from './submission-settings.ts'

export {
  BUSY_ENTER_BEHAVIORS, BUSY_ENTER_FIELD, CONVERSATION_SETTINGS_NAMESPACE,
  DEFAULT_BUSY_ENTER_BEHAVIOR, type BusyEnterBehavior, type ConversationSettings,
} from './submission-settings.ts'

/** Composition-owned ordinary and blank-session composer copy. */
export interface Config {
  /** Localized ordinary placeholder, excluding blocked, plan, and steering states. */
  inputPlaceholder?: LocalizedPlaceholder
  /** Localized blank-session placeholder, excluding workspace and model prerequisites. */
  heroPlaceholder?: LocalizedPlaceholder
}

/** Configuration fields published as the conversation settings base layer. */
export const Config: z<Config> = z.object({
  inputPlaceholder: LocalizedPlaceholderSchema,
  heroPlaceholder: LocalizedPlaceholderSchema,
})

/**
 * Register the durable conversation section when a settings provider exists.
 * @param ctx - Host context whose optional settings service owns the section.
 * @param config - Composition-owned localized placeholder defaults.
 */
export function apply(ctx: Context, config: Config = {}): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      CONVERSATION_SETTINGS_NAMESPACE,
      ConversationSettingsSchema,
      { base: config },
    )
  })
}
