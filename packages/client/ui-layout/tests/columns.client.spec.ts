import { describe, expect, it } from 'vitest'
import {
  CENTER_MIN, clampWidth, computeColumns,
  DETAILS_DEFAULT, DETAILS_MIN, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT, SIDEBAR_MIN,
  SHELF_DEFAULT, SHELF_MAX, SHELF_MIN,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'

// Numeric preference form (0 = closed); helpers keep the scenario names readable.
const open = (width: number) => width
const closed = (_width: number) => 0

describe('clampWidth', () => {
  it('clamps into the range and rounds', () => {
    expect(clampWidth(250.4, 240, 420)).toBe(250)
    expect(clampWidth(100, 240, 420)).toBe(240)
    expect(clampWidth(9999, 240, 420)).toBe(420)
  })
})

describe('computeColumns', () => {
  it('step 1: everything fits at preferred widths', () => {
    const cols = computeColumns(1920, open(SIDEBAR_DEFAULT), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: 1920 - 280 - 360, shelf: 0, details: 360 })
  })

  it('closed sidebar keeps its compact rail while closed shelf and details contribute zero width', () => {
    expect(computeColumns(1920, closed(300), closed(360), closed(360)))
      .toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 1920 - SIDEBAR_COLLAPSED, shelf: 0, details: 0 })
  })

  it('preferences beyond the clamp range are clamped before solving', () => {
    const cols = computeColumns(1920, open(9999), closed(SHELF_DEFAULT), open(1))
    expect(cols.sidebar).toBe(420)
    expect(cols.details).toBe(300)
    expect(computeColumns(1920, open(1), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT)).sidebar).toBe(SIDEBAR_MIN)
  })

  it('step 2: details shrinks first, center pinned at min (shelf closed)', () => {
    // 280 + 360 + CENTER_MIN exceeds the viewport by 30; details concedes to 330.
    const cols = computeColumns(280 + 360 + CENTER_MIN - 30, open(SIDEBAR_DEFAULT), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: CENTER_MIN, shelf: 0, details: 330 })
  })

  it('boundary: exactly at the step-1/step-2 seam', () => {
    const cols = computeColumns(300 + 360 + CENTER_MIN, open(300), closed(SHELF_DEFAULT), open(360))
    expect(cols).toEqual({ sidebar: 300, center: CENTER_MIN, shelf: 0, details: 360 })
    const one = computeColumns(300 + 360 + CENTER_MIN - 1, open(300), closed(SHELF_DEFAULT), open(360))
    expect(one).toEqual({ sidebar: 300, center: CENTER_MIN, shelf: 0, details: 359 })
  })

  it('step 3: details auto-closes when its min still starves center — sidebar holds its preference', () => {
    // 280 + DETAILS_MIN + CENTER_MIN exceeds the viewport by 10 → details 0; sidebar untouched: center = viewport - 280.
    const viewport = 280 + DETAILS_MIN + CENTER_MIN - 10
    const cols = computeColumns(viewport, open(SIDEBAR_DEFAULT), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: viewport - 280, shelf: 0, details: 0 })
  })

  it('the sidebar never concedes: center absorbs the deficit below CENTER_MIN', () => {
    // 700 < 280+640: sidebar keeps 280, center takes 420 < CENTER_MIN.
    const cols = computeColumns(700, open(SIDEBAR_DEFAULT), closed(SHELF_DEFAULT), closed(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: SIDEBAR_DEFAULT, center: 420, shelf: 0, details: 0 })
  })

  it('sidebar-closed narrow window: details concedes then auto-closes', () => {
    const fits = computeColumns(SIDEBAR_COLLAPSED + DETAILS_MIN + CENTER_MIN, closed(300), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(fits).toEqual({ sidebar: SIDEBAR_COLLAPSED, center: CENTER_MIN, shelf: 0, details: DETAILS_MIN })
    const starved = computeColumns(
      SIDEBAR_COLLAPSED + DETAILS_MIN + CENTER_MIN - 1, closed(300), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT),
    )
    expect(starved).toEqual({
      sidebar: SIDEBAR_COLLAPSED,
      center: DETAILS_MIN + CENTER_MIN - 1,
      shelf: 0,
      details: 0,
    })
  })

  it('tiny viewport: details closes, sidebar holds, center takes the remainder', () => {
    const cols = computeColumns(400, open(SIDEBAR_DEFAULT), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols.details).toBe(0)
    expect(cols.sidebar).toBe(SIDEBAR_DEFAULT)
    expect(cols.center).toBe(Math.max(0, 400 - SIDEBAR_DEFAULT))
  })

  it('recovery is pure: re-widening restores preferred widths untouched', () => {
    const squeezed = computeColumns(
      280 + DETAILS_MIN + CENTER_MIN - 120, open(SIDEBAR_DEFAULT), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT),
    )
    expect(squeezed.details).toBe(0)
    const restored = computeColumns(1920, open(SIDEBAR_DEFAULT), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.sidebar).toBe(SIDEBAR_DEFAULT)
  })
})

describe('computeColumns — the shelf column', () => {
  it('an open shelf joins the fit at its preferred width', () => {
    const cols = computeColumns(1920, open(SIDEBAR_DEFAULT), open(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({
      sidebar: 280, center: 1920 - 280 - 400 - 360, shelf: SHELF_DEFAULT, details: 360,
    })
  })

  it('step 2: the shelf shrinks first, center pinned at min', () => {
    // 280 + 400 + 360 + CENTER_MIN exceeds the viewport by 1; shelf concedes to 399.
    const cols = computeColumns(
      280 + SHELF_DEFAULT + 360 + CENTER_MIN - 1, open(SIDEBAR_DEFAULT), open(SHELF_DEFAULT), open(DETAILS_DEFAULT),
    )
    expect(cols).toEqual({ sidebar: 280, center: CENTER_MIN, shelf: SHELF_DEFAULT - 1, details: 360 })
  })

  it('step 3: details shrinks after the shelf reached its minimum', () => {
    // 280 + SHELF_MIN + 360 + CENTER_MIN exceeds the viewport by 1; shelf floors at its min, details concedes to 359.
    const cols = computeColumns(280 + SHELF_MIN + 360 + CENTER_MIN - 1, open(SIDEBAR_DEFAULT), open(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: CENTER_MIN, shelf: SHELF_MIN, details: 359 })
  })

  it('step 4: details auto-closes before the shelf concedes — shelf never auto-closes', () => {
    // 280 + SHELF_MIN + DETAILS_MIN + CENTER_MIN exceeds the viewport by 1; details closes, shelf keeps its floor.
    const viewport = 280 + SHELF_MIN + DETAILS_MIN + CENTER_MIN - 1
    const cols = computeColumns(viewport, open(SIDEBAR_DEFAULT), open(SHELF_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: viewport - 280 - SHELF_MIN, shelf: SHELF_MIN, details: 0 })
  })

  it('shelf preferences clamp into their contract range', () => {
    // A viewport wide enough to host SHELF_MAX beside the sidebar, details and CENTER_MIN.
    const cols = computeColumns(2560, open(SIDEBAR_DEFAULT), open(9999), open(DETAILS_DEFAULT))
    expect(cols.shelf).toBe(SHELF_MAX)
    const small = computeColumns(2560, open(SIDEBAR_DEFAULT), open(1), open(DETAILS_DEFAULT))
    expect(small.shelf).toBe(SHELF_MIN)
  })
})

describe('computeColumns — degenerate viewports', () => {
  it('sidebar closed and viewport below CENTER_MIN: details auto-closes, center takes the rest', () => {
    // Reaches step 4's auto-close with the compact rail sidebar.
    expect(computeColumns(500, closed(300), closed(SHELF_DEFAULT), open(DETAILS_DEFAULT)))
      .toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 500 - SIDEBAR_COLLAPSED, shelf: 0, details: 0 })
  })
})
