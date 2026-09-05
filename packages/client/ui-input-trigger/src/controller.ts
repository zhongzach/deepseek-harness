/**
 * Standalone controller library for replacement input-trigger providers.
 * This entry exports no Cordis plugin body, registers no service or slot,
 * and borrows the consumer's shared client runtime for snapshot stores.
 * Consumers own controller instances and their session-scope teardown.
 */
export { InputTriggerController } from './client/controller.ts'
export type { InputTriggerControllerDeps, SourceRoster } from './client/controller.ts'
