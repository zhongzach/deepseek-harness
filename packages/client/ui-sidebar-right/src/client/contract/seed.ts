/**
 * The guide tab's identity, the page-address scheme, and default page selection.
 *
 * These live in the contract because two sides need them and neither may read
 * the other: the store seeds new panes from the registry, and the guide
 * domain registers the type under the same kind.
 *
 * The docking kit treats `kind` as opaque, so these strings mean something only
 * here and in the registry. Both types go through the same two stages any other
 * type would use — the guide is not special in the machinery, only in being
 * always available.
 */
import type { SidebarRightTabDefinition, SidebarRightTabRegistry } from '../tab-registry.ts'

/** One pane's initial page, resolved from the current registered guide entries. */
export interface SidebarRightSeed {
  readonly kind: string
  readonly title: string
  /** Retain the default navigation page beside opened resources. */
  readonly retain?: boolean
}

/**
 * Prefer an explicitly retained guide entry, otherwise use the registered entry count.
 * @param tabs - current tab registry.
 * @returns the retained page with the lowest guide order, otherwise the sole entry or guide.
 */
export function defaultSeed(tabs: SidebarRightTabRegistry): SidebarRightSeed {
  return defaultSeedFromDefinitions(tabs.entries())
}

/**
 * Resolve the same default from the reactive catalog used by the pane chrome.
 * @param definitions - currently effective tab types, including the built-in guide.
 * @returns the shared default-page and retention policy.
 */
export function defaultSeedFromDefinitions(definitions: readonly SidebarRightTabDefinition[]): SidebarRightSeed {
  const choices = definitions.flatMap(definition => (definition.guide ?? []).map(guide => ({
    kind: definition.kind, order: guide.order, retained: definition.retainAsDefault,
  })))
  const [only, ...others] = choices
  const single = only !== undefined && others.length === 0
  const preferred = choices.filter(choice => choice.retained).sort((a, b) => a.order - b.order)[0]
  const kind = preferred?.kind ?? (single ? only.kind : GUIDE_KIND)
  const definition = definitions.find(value => value.kind === kind)
  if (definition === undefined) throw new Error(`sidebarRight: default tab kind "${kind}" is not registered`)
  return { kind, title: definition.title(pageAddress(kind)), ...definition.retainAsDefault ? { retain: true } : {} }
}

/** The guide tab's kind. */
export const GUIDE_KIND = 'guide'

/**
 * The address a page tab is recorded under: `sidebar://<kind>`. The scheme is
 * this package's bookkeeping for `openTab`, spelled here and nowhere else; a
 * caller names the kind and never sees or composes the address.
 * @param kind - the page type's kind.
 * @returns the page's address.
 */
export function pageAddress(kind: string): string {
  return `sidebar://${kind}`
}
