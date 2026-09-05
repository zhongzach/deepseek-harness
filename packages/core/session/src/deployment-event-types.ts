/** Composition-owned event vocabulary for current Session restoration. */

import { KNOWN_SESSION_EVENT_TYPES } from './known-event-types.ts'

const registrations = new Map<string, number>()

/**
 * Register one deployment event for current-format restoration.
 * Historical migration requires a separate validated format registration.
 * @param type - exact deployment-owned event name.
 * @returns an idempotent disposer for this registration.
 */
export function registerSessionEventType(type: string): () => void {
  registrations.set(type, (registrations.get(type) ?? 0) + 1)
  let active = true
  return () => {
    if (!active) return
    active = false
    const remaining = (registrations.get(type) ?? 1) - 1
    if (remaining === 0) registrations.delete(type)
    else registrations.set(type, remaining)
  }
}

/**
 * Inspect the current build and active deployment vocabulary.
 * @param type - exact event name.
 * @returns whether this composition understands the event.
 */
export function isKnownSessionEventType(type: string): boolean {
  return KNOWN_SESSION_EVENT_TYPES.has(type) || registrations.has(type)
}

/**
 * Snapshot the known vocabulary when restoring a current artifact.
 * @returns a detached set including active deployment registrations.
 */
export function knownSessionEventTypes(): ReadonlySet<string> {
  return new Set([...KNOWN_SESSION_EVENT_TYPES, ...registrations.keys()])
}
