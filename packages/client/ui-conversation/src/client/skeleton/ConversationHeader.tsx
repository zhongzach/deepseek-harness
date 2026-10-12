/**
 * Resident conversation navigation and Session-specific header content.
 *
 * A product title bar may host the header: an element marked
 * `data-conversation-header-host` receives it through a portal (React context
 * and the Session scope stay intact), so the window has one top bar instead of
 * a title bar plus a header row. The host announces itself with a
 * `dsh:conversation-header-host` window event when it mounts or unmounts;
 * without a host the header renders in place, above the conversation.
 */
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { ConversationHeaderProps } from '../contract/slots.ts'
import { conversationPhase } from '../contract/snapshot.ts'
import css from './ConversationRoot.module.css'

/** Marks the element that hosts the header, and names the event announcing it. */
const HOST_SELECTOR = '[data-conversation-header-host]'
const HOST_EVENT = 'dsh:conversation-header-host'

/**
 * Keeps global navigation available before a Session exists.
 * @param props - Optional Session sources and authorized header slots.
 * @returns The persistent header with any selected Session's title and views.
 */
export function ConversationHeader({ sessionId, useSession, useConversation, renderSlot }: ConversationHeaderProps) {
  const session = useSession(s => s)
  const conversation = useConversation(s => s)
  const blank = session === undefined || conversation === undefined
    || (session.blank && conversationPhase(session, conversation) === 'blank')
  const [host, setHost] = useState<Element | null>(null)
  useLayoutEffect(() => {
    const find = (): void => { setHost(document.querySelector(HOST_SELECTOR)) }
    find()
    window.addEventListener(HOST_EVENT, find)
    return () => { window.removeEventListener(HOST_EVENT, find) }
  }, [])
  const header = (
    <header
      className={clsx(
        css.header, blank && css.headerBlank, sessionId === undefined && css.headerSessionless,
        host !== null && css.headerHosted,
      )}
      data-window-drag
    >
      <div className={css.headerLeading} data-conversation-header-leading="">
        {renderSlot('conversation.header.leading', {})}
      </div>
      {sessionId === undefined
        ? <div className={css.titleRow} />
        : renderSlot('conversation.session.header', { hideChrome: blank })}
    </header>
  )
  return host === null ? header : createPortal(header, host)
}
