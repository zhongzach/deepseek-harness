/** Welcome acknowledgement and the composition onboarding toggle stored in the plugin configuration. */
import type {} from '@deepseek-ai/dsh-settings'

import type { Volatile, Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/**
 * Runtime preferences projected to the browser: the per-person
 * acknowledgement plus the product-wide onboarding facts a composition
 * decides. The composition toggle rides this entry's configuration base
 * layer, so the browser reads everything through the same configuration
 * form, and a person's own settings document can still override it.
 */
export interface Config {
  /** Last acknowledged welcome notice version. */
  welcomeNoticeVersion: Volatile<string | undefined>
  /**
   * Show the internal-testing welcome notice until its current copy version
   * is acknowledged. A downstream composition that owns its own onboarding
   * turns it off; the shipped GUI keeps it on.
   */
  welcomeNotice: Volatile<boolean>
}

/** Live welcome preference and composition onboarding toggle. */
export const Config = z.object({
  welcomeNoticeVersion: z.string().volatile(),
  welcomeNotice: z.boolean().default(true).volatile(),
})

/** The browser consumes the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
