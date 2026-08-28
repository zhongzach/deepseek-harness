// @vitest-environment jsdom
/** Real picker/popup interactions over the model plugin's live directory and action event. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import type { ModelProviderGroup, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import { createScope } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { CommandContribution } from '@deepseek-ai/dsh-client-ui-commands/client'
import { PopupSelectController } from '@deepseek-ai/dsh-client-ui-commands/src/client/popup.ts'
import { PopupSelectView } from '@deepseek-ai/dsh-client-ui-commands/src/client/PopupSelectView.tsx'
import { zh as commandZh } from '@deepseek-ai/dsh-client-ui-commands/src/client/locales.ts'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { apply, inject } from '../src/client/index.ts'
import { ModelSelect } from '../src/client/ModelSelect.tsx'
import type { ModelSelectInjected } from '../src/client/slots.ts'
import { zh } from '../src/client/locales.ts'

const roots = new Set<Context>()
const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
beforeEach(() => {
  // jsdom has no scrolling layout; this is the only missing DOM capability used by the real popup.
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value() {} })
})
afterEach(async () => {
  cleanup()
  for (const ctx of roots) await ctx.fiber.dispose()
  roots.clear()
  if (scrollDescriptor === undefined) Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  else Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor)
})

const action = { id: 'deployment:membership', label: '开通会员' }
const groups: ModelProviderGroup[] = [{
  id: 'hub', name: '云模型', models: [
    { id: 'free', name: '免费模型', availability: { selectable: true, action: { id: 'unused', label: '不应显示' } } },
    { id: 'premium', name: '专供模型', availability: { selectable: false, reason: '需要有效会员', action } },
    { id: 'premium-next', name: '另一个专供模型', availability: { selectable: false, reason: '需要有效会员', action } },
  ],
}]

async function boot() {
  const ctx = new Context()
  roots.add(ctx)
  const sessionId = 'model-actions-session' as SessionId
  const current = { provider: 'hub', model: 'free' }
  const selectModel = vi.fn(async () => ({ result: { ok: true, value: { selected: current } } }))
  ctx.provide('connection', { api: { sessions: {
    models: vi.fn(async () => ({ result: { ok: true, value: { current, routable: true, groups, failures: [] } } })),
    selectModel,
  } } })
  let contribution: CommandContribution | undefined
  ctx.provide('commandUi', {
    register(next: CommandContribution) { contribution = next; return () => { contribution = undefined } },
  })
  let injectFace: ((sessionId: SessionId) => ModelSelectInjected) | undefined
  ctx.provide('slots', {
    inject(_name: string, callback: () => () => void) { return callback() },
    register(options: { inject: (id: SessionId) => ModelSelectInjected }) {
      injectFace = options.inject
      return () => { injectFace = undefined }
    },
  })
  const sessionScope = createScope(ctx, sessionId)
  ctx.provide('sessions', {
    scope: (id: SessionId) => id === sessionId ? sessionScope.ctx : undefined,
    subagentAddress: () => undefined,
  })
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  new TestRemote(ctx)
  await ctx.plugin({ inject: [...inject], apply }).await()
  await ctx.plugin(function probe() {}).await()
  const guide = vi.fn()
  ctx.on('model-selection/action', guide)
  return { ctx, sessionId, selectModel, guide, contribution: contribution!, face: injectFace!(sessionId) }
}

describe('unavailable model help', () => {
  it.each(['click', 'Enter', ' '] as const)('composer %s opens the advertised guide without selecting a disabled model', async (gesture) => {
    const b = await boot()
    render(<ModelSelect locked={false} {...b.face} t={makeTranslate(zh, commonZh)} />)
    const trigger = await screen.findByRole('button', { name: '选择模型，当前 免费模型' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    await waitFor(() => { expect(b.face.directory.getSnapshot().status).toBe('ready') })
    const locked = screen.getByRole<HTMLButtonElement>('menuitemradio', { name: /^专供模型/ })
    expect(locked.disabled).toBe(true)
    fireEvent.click(locked)
    fireEvent.keyDown(locked, { key: 'Enter' })
    expect(b.guide).not.toHaveBeenCalled()
    expect(b.selectModel).not.toHaveBeenCalled()
    const help = screen.getByRole('menuitem', { name: '开通会员' })
    expect(screen.queryByRole('menuitem', { name: '不应显示' })).toBeNull()
    expect(help.closest('button button')).toBeNull()
    if (gesture === 'click') fireEvent.click(help)
    else {
      const free = screen.getByRole('menuitemradio', { name: '免费模型' })
      act(() => { free.focus() })
      fireEvent.keyDown(free, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(help)
      fireEvent.keyDown(help, { key: gesture })
    }
    expect(b.guide).toHaveBeenCalledExactlyOnceWith(action.id)
    expect(b.selectModel).not.toHaveBeenCalled()
    expect(b.face.directory.getSnapshot().current).toEqual({ provider: 'hub', model: 'free' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it.each(['click', 'Enter', ' '] as const)('/model %s keeps filtered disabled rows inert and opens their separate footer action', async (gesture) => {
    const b = await boot()
    const consume = vi.fn(() => true)
    const focusComposer = vi.fn()
    const popup = new PopupSelectController({ consume, focusComposer })
    render(<PopupSelectView popup={popup} t={makeTranslate(commandZh, commonZh)} />)
    act(() => { popup.open('model', b.contribution.ui, { sessionId: b.sessionId }, { via: 'enter', token: '/model' }) })
    await screen.findByRole('option', { name: /^专供模型/ })
    const search = screen.getByRole('textbox', { name: '筛选选项' })
    fireEvent.change(search, { target: { value: '专供模型' } })
    const locked = screen.getByRole('option', { name: /^专供模型/ })
    expect(locked.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(locked)
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(b.selectModel).not.toHaveBeenCalled()
    expect(b.guide).not.toHaveBeenCalled()
    expect(consume).not.toHaveBeenCalled()
    const help = screen.getByRole('button', { name: '开通会员' })
    expect(help.closest('[role="option"]')).toBeNull()
    expect(screen.queryByRole('button', { name: '不应显示' })).toBeNull()
    b.guide.mockImplementation(() => { expect(popup.state.getSnapshot().open).toBe(false) })
    if (gesture === 'click') fireEvent.click(help)
    else {
      act(() => { help.focus() })
      fireEvent.keyDown(help, { key: gesture })
    }
    expect(b.guide).toHaveBeenCalledExactlyOnceWith(action.id)
    expect(b.selectModel).not.toHaveBeenCalled()
    expect(consume).not.toHaveBeenCalled()
    expect(focusComposer).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
