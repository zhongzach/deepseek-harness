/** Composition-owned Chat metric controls. */
import z from '@deepseek-ai/schemastery'

/** Chat presentation configuration independent of recorded usage. */
export interface Config {
  /** Show per-Turn token and timing controls beside message actions. */
  showTurnMetrics?: boolean
}

/** Runtime schema for the Host plugin's presentation defaults. */
export const Config: z<Config> = z.object({
  showTurnMetrics: z.boolean().default(true),
})
