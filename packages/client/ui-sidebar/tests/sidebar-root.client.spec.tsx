// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type {
  SidebarBrandOwnerProps, SidebarFooterActionOwnerProps, SidebarRootComponentProps,
  SidebarSectionOwnerProps, SidebarSettingsOwnerProps,
} from '../src/client/contract/slots.ts'
import { SidebarRoot } from '../src/client/SidebarRoot.tsx'
import { en } from '../src/client/locales.ts'

// English-dictionary translate stub: the shell renders the same copy the
// assertions below query by accessible name.
const t: SidebarRootComponentProps['t'] = key => (en as Record<string, string>)[key] ?? key

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// The shell never reads the global hooks itself, but they ride the standard
// props share; stub them as never-called functions.
const neverHook = (() => { throw new Error('shell must not read global hooks') }) as never

interface MountOptions {
  collapsed?: boolean
  width?: number
  /** A registered brand mark; absent = the hole is unregistered (fallback renders). */
  brand?: (owner: SidebarBrandOwnerProps) => ReactNode
}

function mountShell({ collapsed = false, width = 300, brand }: MountOptions = {}) {
  const startSession = vi.fn()
  const toggleSidebar = vi.fn()
  let regionOwner: SidebarSectionOwnerProps | undefined
  let settingsOwner: SidebarSettingsOwnerProps | undefined
  let footerActionOwner: SidebarFooterActionOwnerProps | undefined
  const brandOwners: SidebarBrandOwnerProps[] = []
  let current = { collapsed, width }
  const root = () => (
    <SidebarRoot
      collapsed={current.collapsed} width={current.width}
      useSessions={neverHook} useWorkspaces={neverHook}
      startSession={startSession} toggleSidebar={toggleSidebar} t={t}
      renderSlot={((
        key: string,
        owner: SidebarBrandOwnerProps | SidebarFooterActionOwnerProps | SidebarSectionOwnerProps | SidebarSettingsOwnerProps,
        opts?: { fallback?: ReactNode },
      ) => {
        if (key === 'sidebar.brand') {
          // Unregistered hole → the machinery renders the owner's fallback;
          // a registered mark renders instead of it.
          brandOwners.push(owner)
          return brand === undefined ? opts?.fallback ?? null : brand(owner)
        }
        if (key === 'sidebar.settings') {
          settingsOwner = owner
          return <div data-testid="settings-seat" data-wide={owner.wide} />
        }
        if (key === 'sidebar.footer.action') {
          footerActionOwner = owner
          return <div data-testid="footer-action-seat" data-wide={owner.wide} />
        }
        regionOwner = owner as SidebarSectionOwnerProps
        return <div data-testid="region" data-wide={owner.wide} />
      }) as SidebarRootComponentProps['renderSlot']}
    />
  )
  const view = render(root())
  return {
    startSession,
    toggleSidebar,
    regionOwner: () => {
      if (regionOwner === undefined) throw new Error('region owner not rendered')
      return regionOwner
    },
    settingsOwner: () => {
      if (settingsOwner === undefined) throw new Error('settings owner not rendered')
      return settingsOwner
    },
    footerActionOwner: () => {
      if (footerActionOwner === undefined) throw new Error('footer action owner not rendered')
      return footerActionOwner
    },
    /** Every owner share the brand hole was rendered with, in render order. */
    brandOwners,
    rerender(next: Partial<typeof current>) {
      current = { ...current, ...next }
      view.rerender(root())
    },
  }
}

describe('SidebarRoot shell', () => {
  it('routes New Session (capsule + wordmark) and the column toggle', () => {
    const b = mountShell()
    // Expanded, both the wordmark and the capsule start a session.
    const starters = screen.getAllByRole('button', { name: 'New session' })
    expect(starters).toHaveLength(2)
    for (const button of starters) fireEvent.click(button)
    expect(b.startSession).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(b.toggleSidebar).toHaveBeenCalledOnce()
  })

  it('hands the region its wide flag and clamps expandSidebar to the collapsed state', () => {
    const b = mountShell()
    expect(b.regionOwner().wide).toBe(true)
    // The settings seat rides the same wide flag (ui-settings renders the row).
    expect(b.settingsOwner().wide).toBe(true)
    expect(b.footerActionOwner().wide).toBe(true)
    // Expanded: the request is a no-op (no accidental collapse).
    b.regionOwner().expandSidebar()
    expect(b.toggleSidebar).not.toHaveBeenCalled()
  })

  it('keeps the region mounted through collapse and expands on its request', () => {
    vi.useFakeTimers()
    const b = mountShell()
    b.rerender({ collapsed: true })
    // Wide content survives the crossfade window, then settles into the rail.
    expect(b.regionOwner().wide).toBe(true)
    vi.advanceTimersByTime(200)
    b.rerender({})
    expect(b.regionOwner().wide).toBe(false)
    expect(b.footerActionOwner().wide).toBe(false)
    expect(screen.getByTestId('region')).toBeTruthy()
    b.regionOwner().expandSidebar()
    expect(b.toggleSidebar).toHaveBeenCalledOnce()
  })

  it('renders statically collapsed on a cold start (no crossfade classes)', () => {
    const b = mountShell({ collapsed: true })
    expect(b.regionOwner().wide).toBe(false)
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeTruthy()
  })
})

describe('SidebarRoot brand hole', () => {
  it('renders the shell-owned mark while the hole is unregistered (wide → wordmark, rail → glyph)', () => {
    vi.useFakeTimers()
    const b = mountShell()
    // Expanded: the wordmark shortcut carries the fallback mark, and both
    // New Session arms (wordmark + capsule) still exist.
    expect(b.brandOwners.at(-1)).toEqual({ wide: true })
    expect(screen.getAllByRole('button', { name: 'New session' })).toHaveLength(2)
    b.rerender({ collapsed: true })
    vi.advanceTimersByTime(200)
    b.rerender({})
    // Rail: the hole is rendered again, as the toggle's resting glyph.
    expect(b.brandOwners.at(-1)).toEqual({ wide: false })
    expect(b.brandOwners.some(owner => owner.wide)).toBe(true)
  })

  it('lets a registered mark replace both the wordmark and the rail glyph', () => {
    vi.useFakeTimers()
    const b = mountShell({ brand: owner => <span data-testid="my-brand" data-wide={owner.wide}>My Product</span> })
    expect(screen.getByTestId('my-brand').getAttribute('data-wide')).toBe('true')
    // The wordmark button still starts a session: the shell owns the control, the occupant only the mark.
    fireEvent.click(screen.getByTestId('my-brand'))
    expect(b.startSession).toHaveBeenCalledOnce()
    b.rerender({ collapsed: true })
    vi.advanceTimersByTime(200)
    b.rerender({})
    expect(screen.getByTestId('my-brand').getAttribute('data-wide')).toBe('false')
    // The rail glyph sits inside the expand toggle, so it still toggles the column.
    fireEvent.click(screen.getByTestId('my-brand'))
    expect(b.toggleSidebar).toHaveBeenCalledOnce()
  })
})
