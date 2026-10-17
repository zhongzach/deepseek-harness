import { describe, expect, it } from 'vitest'
import { layoutKey, layoutRows } from '../src/client/layout-rows.ts'

const registered = [
  { id: 'models', order: 10, label: 'Models' },
  { id: 'general', order: 0, label: 'General' },
  { id: 'account', order: -10, label: 'Account' },
  { id: 'about', order: 100, label: 'About' },
]
const page = (id: string, order: number) => ({ id, order, label: id, groups: [{ items: [`${id}-row`] }] })

describe('settings navigation under a layout', () => {
  it('keeps the registered sections, in order, when nobody lays the panel out', () => {
    expect(layoutRows(registered, undefined).map(row => row.id)).toEqual(['account', 'general', 'models', 'about'])
    expect(layoutRows(registered, {}).every(row => row.divider === undefined && row.page === undefined)).toBe(true)
  })

  it('puts the General pages in place of General, each carrying its page', () => {
    const rows = layoutRows(registered, { pages: [page('look', 6), page('writing', 5)] })
    expect(rows.map(row => row.id)).toEqual(['account', 'writing', 'look', 'models', 'about'])
    expect(rows.find(row => row.id === 'look')?.page?.groups[0]?.items).toEqual(['look-row'])
  })

  it('lets a page keep the General entry, or take over a registered section', () => {
    expect(layoutRows(registered, { pages: [page('general', 0)] }).filter(row => row.id === 'general')).toHaveLength(1)
    const rows = layoutRows(registered, { pages: [page('models', 10)] })
    expect(rows.filter(row => row.id === 'models')).toHaveLength(1)
    expect(rows.find(row => row.id === 'models')?.page).toBeDefined()
    expect(rows.some(row => row.id === 'general')).toBe(false)
  })

  it('divides the navigation above the named rows, never above the first', () => {
    const rows = layoutRows(registered, { pages: [page('writing', 5)], dividers: ['account', 'writing', 'about', 'nowhere'] })
    expect(rows.filter(row => row.divider === true).map(row => row.id)).toEqual(['writing', 'about'])
  })

  it('keys an answer by its content, and no answer as empty', () => {
    expect(layoutKey(undefined)).toBe('')
    expect(layoutKey({ dividers: ['a'] })).toBe(layoutKey({ dividers: ['a'] }))
    expect(layoutKey({ dividers: ['a'] })).not.toBe(layoutKey({ dividers: ['b'] }))
  })
})
