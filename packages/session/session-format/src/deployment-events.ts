/** Explicit preservation of deployment-owned informational events across format edges. */

import { SessionFormatError } from './error.ts'
import type { SessionFormatEvent, SessionFormatJsonValue } from './types.ts'

/** A log-only payload whose contents contain no Session sequence references. */
export interface OpaqueSessionEventRegistration {
  /** Exact format generations whose event payload this plugin validates. */
  readonly versions: readonly number[]
  /** Reject malformed payloads; accepted values are preserved without rewriting. */
  readonly validateData: (data: SessionFormatJsonValue) => void
}

const registrations = new Map<string, Set<OpaqueSessionEventRegistration>>()

/**
 * Register known informational payloads for lossless adjacent migration.
 * The owning plugin guarantees the payload has no embedded sequence references.
 * @param type - exact deployment-owned event name.
 * @param registration - supported generations and payload validator.
 * @returns a disposer that removes only this registration.
 */
export function registerOpaqueSessionEvent(
  type: string,
  registration: OpaqueSessionEventRegistration,
): () => void {
  const owned = Object.freeze({ ...registration, versions: Object.freeze([...registration.versions]) })
  const entries = registrations.get(type) ?? new Set<OpaqueSessionEventRegistration>()
  entries.add(owned)
  registrations.set(type, entries)
  return () => {
    entries.delete(owned)
    if (entries.size === 0 && registrations.get(type) === entries) registrations.delete(type)
  }
}

/**
 * Validate an explicitly registered opaque event for one format generation.
 * @param event - decoded historical or target event.
 * @param version - generation whose payload is being interpreted.
 * @returns true only for a registered and validated log-only event.
 */
export function isRegisteredOpaqueSessionEvent(event: SessionFormatEvent, version: number): boolean {
  const entries = registrations.get(event.type)
  const supported = entries === undefined ? [] : [...entries].filter(entry => entry.versions.includes(version))
  if (supported.length === 0) return false
  if (Object.hasOwn(event, 'surfaceOp') || Object.hasOwn(event, 'sourceEventSeqs')) {
    throw new SessionFormatError(`deployment event ${JSON.stringify(event.type)} must be log-only without sequence references`)
  }
  for (const entry of supported) entry.validateData(event.data)
  return true
}
