// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RunningDots } from '../src/client/chat/RunningDots.tsx'

afterEach(cleanup)

describe('RunningDots', () => {
  it('renders three decorative dots in a fixed seat, with no mascot artwork and no inline styles', () => {
    const view = render(<RunningDots />)
    const icon = view.container.firstElementChild!
    expect(icon.tagName).toBe('SPAN')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.children).toHaveLength(3)
    for (const dot of icon.children) {
      expect(dot.tagName).toBe('SPAN')
      expect(dot.childElementCount).toBe(0)
    }
    // The pulse is CSS on the dot: no SVG, no SMIL, nothing inline.
    expect(view.container.querySelector('svg')).toBeNull()
    expect(view.container.querySelector('animate')).toBeNull()
    expect(view.container.querySelector('[style]')).toBeNull()
  })
})
