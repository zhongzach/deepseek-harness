/** Navigation rows under a composition's settings layout (`ui-settings/layout`). */
import type { SettingsLayout } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsSectionRow } from './shell-contract.ts'

/** The General section's id: the entry that draws every General page. */
export const GENERAL_SECTION_ID = 'general'

/**
 * Merge the registered sections with the layout's General pages, in order.
 * While pages are laid out the General entry itself leaves the navigation (its
 * rows appear on the pages instead), unless a page reuses its id; a page whose id
 * a registered section already uses replaces that section's row. Divider ids mark
 * the first row of a navigation group; the very first row never draws one.
 * @param registered - rows projected from settings.section registrations.
 * @param layout - the composition's answer, or undefined for the default panel.
 * @returns the navigation rows in order.
 */
export function layoutRows(registered: readonly SettingsSectionRow[], layout: SettingsLayout | undefined): readonly SettingsSectionRow[] {
  const pages = layout?.pages ?? []
  const dividers = new Set(layout?.dividers ?? [])
  const paged = new Set(pages.map(page => page.id))
  const rows: SettingsSectionRow[] = [
    ...registered.filter(row => !paged.has(row.id) && !(pages.length > 0 && row.id === GENERAL_SECTION_ID)),
    ...pages.map(page => ({ id: page.id, order: page.order, label: page.label, page })),
  ].sort((a, b) => a.order - b.order)
  return rows.map((row, index) => index > 0 && dividers.has(row.id) ? { ...row, divider: true } : row)
}

/**
 * A stable key for a layout answer, so the navigation projection can tell a changed
 * answer from the same one returned again.
 * @param layout - the composition's answer.
 * @returns the key ('' when nobody answered).
 */
export function layoutKey(layout: SettingsLayout | undefined): string {
  return layout === undefined ? '' : JSON.stringify(layout)
}
