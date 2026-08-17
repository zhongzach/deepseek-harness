/** Host loader entry for the browser implementation exported from `./client`. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Durable settings namespace for product-wide GUI onboarding facts. */
const ONBOARDING_SETTINGS_NAMESPACE = 'ui-onboarding'

/**
 * Plugin config: the product-wide onboarding facts a composition decides.
 * They land as the `ui-onboarding` namespace's composition `base` layer, so
 * the browser reads them through the same settings boundary as the
 * per-person acknowledgement, and a person's own settings document can still
 * override them.
 */
export interface Config {
  /**
   * Show the internal-testing welcome notice until its current copy version
   * is acknowledged. A downstream composition that owns its own onboarding
   * turns it off; the shipped GUI keeps it on.
   */
  welcomeNotice?: boolean
}

/** Runtime schema for the plugin config. */
export const Config: z<Config> = z.object({
  welcomeNotice: z.boolean().default(true),
})

interface OnboardingSettings {
  /** Last version acknowledged by the current product welcome step. */
  welcomeNoticeVersion?: string
  /** Whether the welcome step shows at all (composition base; default on). */
  welcomeNotice?: boolean
}

const OnboardingSettingsSchema: z<OnboardingSettings> = z.object({
  welcomeNoticeVersion: z.string(),
  welcomeNotice: z.boolean(),
})

/**
 * Register the durable GUI-onboarding section when a settings provider exists.
 * @param ctx - host context.
 * @param config - product-wide onboarding facts (composition base layer).
 */
export function apply(ctx: Context, config: Config = {}): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(ONBOARDING_SETTINGS_NAMESPACE),
      OnboardingSettingsSchema,
      { base: { welcomeNotice: config.welcomeNotice ?? true } },
    )
  })
}
