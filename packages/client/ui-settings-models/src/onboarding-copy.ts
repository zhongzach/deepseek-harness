/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-settings-general'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Field deciding whether the notice shows at all. Set by the composition
 * (`ui-settings-general` config → the namespace's base layer); a downstream
 * product that owns its onboarding turns it off. Absent means on.
 */
export const WELCOME_NOTICE_ENABLED_FIELD = 'welcomeNotice'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-13.1'
