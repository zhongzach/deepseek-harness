/** Composer behavior and localized copy stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the conversation plugin. */
export const CONVERSATION_SETTINGS_NAMESPACE = 'ui-conversation'

/** Field carrying the delivery mode for plain Enter while an agent is busy. */
export const BUSY_ENTER_FIELD = 'busyEnter'

/** Busy-Enter behaviors accepted at settings and input boundaries. */
export const BUSY_ENTER_BEHAVIORS = ['queue', 'steer'] as const

/** Configurable meaning of plain Enter while the addressed agent is busy. */
export type BusyEnterBehavior = typeof BUSY_ENTER_BEHAVIORS[number]

/** Default preserves Enter-as-Queue for running conversations. */
export const DEFAULT_BUSY_ENTER_BEHAVIOR: BusyEnterBehavior = 'queue'

/** Product-supplied placeholder text for each browser locale. */
export interface LocalizedPlaceholder {
  /** Chinese placeholder. */
  zh: string
  /** English placeholder. */
  en: string
}

/** Explicit bilingual copy; the union leaves an omitted object absent instead of defaulting it to {}. */
export const LocalizedPlaceholderSchema: z<LocalizedPlaceholder> = z.union([z.object({
  zh: z.string().required(),
  en: z.string().required(),
})])

/** Durable conversation section shared by the Host schema and the browser scope. */
export interface ConversationSettings {
  /** Delivery mode for plain Enter while the addressed agent is busy. */
  busyEnter: BusyEnterBehavior
  /** Ordinary composer placeholder; omission uses the shipped conversation copy. */
  inputPlaceholder?: LocalizedPlaceholder
  /** Blank-session placeholder; omission uses the shipped hero copy. */
  heroPlaceholder?: LocalizedPlaceholder
}

/** Durable conversation schema; also the wire envelope the browser scope validates against. */
export const ConversationSettingsFields = {
  [BUSY_ENTER_FIELD]: z.union([...BUSY_ENTER_BEHAVIORS]).default(DEFAULT_BUSY_ENTER_BEHAVIOR),
  inputPlaceholder: LocalizedPlaceholderSchema,
  heroPlaceholder: LocalizedPlaceholderSchema,
}

/** Schema for shared configuration values. */
export const ConversationSettingsSchema = z.object(ConversationSettingsFields)
