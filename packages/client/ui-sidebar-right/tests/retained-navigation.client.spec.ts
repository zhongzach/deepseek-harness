import { describe, expect, it } from 'vitest'
import { dockPaneIds, findTabPane, getPane, type TabId } from '@deepseek-ai/dsh-client-ui-dockkit'
import { canCloseTab, createSidebarRightStore } from '../src/client/stores.ts'
import { defaultSeedFromDefinitions, pageAddress } from '../src/client/contract/seed.ts'
import type { SidebarRightTabDefinition } from '../src/client/tab-registry.ts'

const SESSION = 'retained-navigation'
function setup(initial = true) {
  let retain = initial
  const instance = createSidebarRightStore(() => ({ kind: 'files', title: 'Files', retain })).create()
  const { actions } = instance
  actions.open(SESSION)
  const surface = () => instance.getSnapshot().bySession[SESSION]!
  const layout = () => surface().layout
  const openFile = (name = 'a.md', replaceTab?: TabId) => {
    let id!: TabId
    actions.openContent(SESSION, { kind: 'document', contentId: `file:${name}`, title: name, ...replaceTab === undefined ? {} : { replaceTab } }, (value) => { id = value })
    return id
  }
  const navigation = () => Object.values(layout().tabs).filter(tab => tab.kind === 'files' && findTabPane(layout(), tab.id).host === 'dock')
  return { actions, surface, layout, openFile, navigation, retain: (value: boolean) => { retain = value } }
}

describe('retained default navigation', () => {
  it('prefers the retained guide entry by order, with stable registration ties and opt-out defaults', () => {
    const definition = (kind: string, order?: number, retainAsDefault?: boolean): SidebarRightTabDefinition => ({
      id: kind, kind, title: () => kind,
      ...order === undefined ? {} : { guide: [{ id: kind, order, title: () => kind }] },
      ...retainAsDefault === undefined ? {} : { retainAsDefault },
    })
    const guide = definition('guide'), files = definition('files', 20, true), other = definition('other', 10)
    expect(defaultSeedFromDefinitions([guide, files, other])).toEqual({ kind: 'files', title: 'files', retain: true })
    expect(defaultSeedFromDefinitions([guide, files, definition('first', 5, true), definition('equal', 5, true)]).kind).toBe('first')
    expect(defaultSeedFromDefinitions([guide, definition('files', 20), other]).kind).toBe('guide')
    expect(defaultSeedFromDefinitions([guide, definition('files', 20)])).toEqual({ kind: 'files', title: 'files' })
  })
  it('keeps a first navigation tab when a resource is opened directly, without taking focus', () => {
    const f = setup(), document = f.openFile()
    const pane = getPane(f.layout(), f.layout().activePaneId), book = f.navigation()[0]!
    expect(pane.tabs).toEqual([book.id, document])
    expect(pane.activeTabId).toBe(document)
    expect(canCloseTab(f.surface(), book.id, 'files')).toBe(false)
    f.actions.closeTab(SESSION, book.id)
    expect(f.navigation()).toHaveLength(1)
    f.actions.closeTab(SESSION, document)
    expect(f.layout().expanded).toBe(true)
    expect(getPane(f.layout(), f.layout().activePaneId).activeTabId).toBe(book.id)
  })
  it('refuses replacement of retained navigation and does not duplicate it on repeated opens', () => {
    const f = setup(); f.actions.setExpanded(SESSION, true)
    const book = f.navigation()[0]!, document = f.openFile('b.md', book.id)
    expect(f.navigation().map(tab => tab.id)).toEqual([book.id])
    expect(getPane(f.layout(), f.layout().activePaneId).activeTabId).toBe(document)
    const count = f.surface().history.entries.length
    f.actions.open(SESSION)
    expect(f.surface().history.entries).toHaveLength(count)
    expect(f.openFile('b.md')).toBe(document)
    expect(f.navigation()).toHaveLength(1)
  })
  it('seeds both split panes and permits a floating copy to close', () => {
    const f = setup(); f.openFile()
    f.actions.splitPane(SESSION)
    expect(dockPaneIds(f.layout())).toHaveLength(2)
    expect(f.navigation()).toHaveLength(2)
    const book = f.navigation()[0]!
    f.actions.floatTab(SESSION, book.id)
    expect(f.navigation()).toHaveLength(2)
    expect(canCloseTab(f.surface(), book.id, 'files')).toBe(true)
    f.actions.closeTab(SESSION, book.id)
    expect(f.layout().tabs[book.id]).toBeUndefined()
    expect(f.navigation()).toHaveLength(2)
  })
  it('protects the retained page on the last pane but lets a split exit through it', () => {
    const f = setup(); f.openFile()
    // Sole docked pane: the retained page is protected (its close routes stay hidden).
    expect(f.navigation()).toHaveLength(1)
    const book = f.navigation()[0]!
    expect(canCloseTab(f.surface(), book.id, 'files')).toBe(false)
    f.actions.splitPane(SESSION)
    expect(dockPaneIds(f.layout())).toHaveLength(2)
    expect(f.navigation()).toHaveLength(2)
    // After a split every copy is closable; closing one empties its pane and
    // the pane collapses back to the single retained page.
    const half = f.navigation()[1]!
    expect(canCloseTab(f.surface(), half.id, 'files')).toBe(true)
    f.actions.closeTab(SESSION, half.id)
    expect(dockPaneIds(f.layout())).toHaveLength(1)
    expect(f.navigation()).toHaveLength(1)
    expect(canCloseTab(f.surface(), f.navigation()[0]!.id, 'files')).toBe(false)
  })
  it('repairs an older open layout and releases protection when the policy is removed', () => {
    const f = setup(false), document = f.openFile()
    expect(f.navigation()).toHaveLength(0)
    f.retain(true); f.actions.open(SESSION)
    const book = f.navigation()[0]!
    expect(book.contentId).toBe(pageAddress('files'))
    expect(getPane(f.layout(), f.layout().activePaneId).activeTabId).toBe(document)
    f.retain(false); f.actions.closeTab(SESSION, book.id)
    expect(f.navigation()).toHaveLength(0)
  })
  it('keeps navigation first after a reorder and preserves reversible open history', () => {
    const f = setup(), document = f.openFile()
    const before = f.layout()
    f.actions.undo(SESSION)
    expect(f.layout().expanded).toBe(false)
    f.actions.redo(SESSION)
    expect(f.layout()).toEqual(before)
    f.actions.placeTab(SESSION, f.navigation()[0]!.id, f.layout().activePaneId, 2)
    const pane = getPane(f.layout(), f.layout().activePaneId)
    expect(pane.tabs[0]).toBe(f.navigation()[0]!.id)
    expect(pane.activeTabId).toBe(document)
  })
})
