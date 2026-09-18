// @vitest-environment jsdom
/** Real command contributions exercised through the Lexical submit facade. */
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { InputTriggerService } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { SessionInputShell } from '@deepseek-ai/dsh-client-ui-conversation/src/client/input/facade.ts'
import type { DraftAttachmentId } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { CommandUiRuntime } from '../src/client/service.ts'
import type { CommandUiSpec } from '../src/client/contract.ts'

async function bench() {
  const runtime = await SlotTestRuntime.create()
  const ctx = runtime.ctx
  const sessionId = 'popup-submit' as SessionId
  await runtime.sessions.add({ id: sessionId })
  runtime.sessions.retainFor(ctx, sessionId, { source: 'mainView' })
  ctx.provide('locale', new LocaleRuntime(ctx))
  runtime.remote.provideNamespaces({ commands: { list: () => Promise.resolve({ ok: true, value: [] }) } })
  await ctx.plugin(InputTriggerService).await()
  await ctx.plugin(CommandUiRuntime).await()
  const actx = runtime.sessions.scope(sessionId)!
  const controller = ctx.inputTriggers.sessionOf(actx)
  const command = ctx.commandUi
  const popup = command.popupFor(actx)
  const sink = vi.fn(() => Promise.resolve({ kind: 'success' as const }))
  const selected = vi.fn()
  const spec: CommandUiSpec = {
    kind: 'popupSelect',
    options: () => Promise.resolve([{ id: 'free', label: 'Free model' }]),
    onSelect: selected,
  }
  command.register({ name: 'model', description: () => 'Model selector', available: () => true, ui: spec })
  const shell = new SessionInputShell({
    actx, inputTriggers: () => controller, popup: () => popup, defaultSink: sink,
    commandAttachments: { serialize: () => Promise.resolve([]), release() {}, unsupportedNotice: () => 'Attachments refused' },
  })
  actx.on('slash/input-consume-token', request => shell.consumeToken(request.guard) ? true : undefined)
  onTestFinished(async () => { shell.dispose(); await runtime.dispose() })
  const openOld = () =>{  popup.open('old', spec, { sessionId }, { via: 'enter', token: '/old' }) }
  return { shell, popup, sink, selected, openOld }
}

describe('submit-layer popup lifetime', () => {
  it('keeps a synchronously opened /model popup alive through Enter cleanup and repeated Enter', async () => {
    const b = await bench()
    b.shell.setDraft('/model')
    b.openOld()
    b.shell.submit()
    b.shell.submit()
    await vi.waitFor(() => { expect(b.popup.state.getSnapshot()).toMatchObject({ open: true, command: 'model', status: 'ready' }) })
    expect(b.shell.snapshot.draft).toBe('/model')
    expect(b.sink).not.toHaveBeenCalled()
    await b.popup.select(0)
    expect(b.selected).toHaveBeenCalledOnce()
    expect(b.shell.snapshot.draft).toBe('')
  })

  it('leaves an existing popup intact when an empty draft makes Enter a no-op', async () => {
    const b = await bench()
    b.openOld()
    b.shell.submit()
    expect(b.popup.state.getSnapshot()).toMatchObject({ open: true, command: 'old' })
    expect(b.shell.snapshot.draft).toBe('')
    expect(b.sink).not.toHaveBeenCalled()
  })

  it('retains a rejected claim, attachments, and the existing popup', async () => {
    const b = await bench()
    const submit = vi.fn(() => Promise.resolve({ kind: 'success' as const }))
    b.shell.setDraft('/deny ')
    b.shell.beginCommand({ name: 'deny', token: '/deny ', submit }, { start: 0, end: 6, draftRev: b.shell.snapshot.draftRev })
    b.shell.addAttachments(['attachment' as DraftAttachmentId])
    b.openOld()
    b.shell.submit()
    expect(b.popup.state.getSnapshot()).toMatchObject({ open: true, command: 'old' })
    expect(b.shell.snapshot.draft).toBe('/deny ')
    expect(b.shell.snapshot.attachmentIds).toEqual(['attachment'])
    expect(submit).not.toHaveBeenCalled()
  })
})
