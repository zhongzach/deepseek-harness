import { describe, expect, it } from 'vitest'
import { isKnownSessionEventType, knownSessionEventTypes, registerSessionEventType } from '../src/deployment-event-types.ts'

describe('deployment event vocabulary', () => {
  it('keeps overlapping registrations until their last owner disposes', () => {
    const name = 'deployment/overlapping'
    const first = registerSessionEventType(name)
    const second = registerSessionEventType(name)
    try {
      expect(knownSessionEventTypes().has(name)).toBe(true)
      first()
      first()
      expect(isKnownSessionEventType(name)).toBe(true)
    } finally {
      first()
      second()
    }
    expect(isKnownSessionEventType(name)).toBe(false)
    expect(isKnownSessionEventType('turn/start')).toBe(true)
  })
})
