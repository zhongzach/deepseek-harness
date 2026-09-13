// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PendingSubmissionBubble, UserMessageNodeView } from '../src/client/chat/MessageItem.tsx'
import type { ChatNodeOwnerProps } from '../src/client/contract/slots.ts'
import type { ComponentProps } from 'react'
import type { SlotMap } from '@deepseek-ai/dsh-client-ui-slots'

type UserTextOwner = SlotMap['conversation.message.user-text']['owner']

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('user text presentation extension', () => {
  it('decorates text while attachment cards and copy retain their source data', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const seen: unknown[] = []
    const renderUserText: NonNullable<ChatNodeOwnerProps['renderUserText']> = (key, owner) => {
      const input = owner as UserTextOwner
      seen.push([key, input.text, input.skillNames])
      return <span>中文技能</span>
    }
    const content = [
      { type: 'text', text: '/original-id' },
      { type: 'file', attachment: { name: 'reference.txt', bytes: 12 } },
    ]
    render(<UserMessageNodeView {...{
      node: { data: { content, skillNames: ['original-id'] } },
      renderUserText, openFile: vi.fn(), renderMessageImages: () => null, t: (key: string) => key,
    } as unknown as ComponentProps<typeof UserMessageNodeView>} />)
    expect(screen.getByText('中文技能')).toBeTruthy()
    expect(screen.getByText('reference.txt')).toBeTruthy()
    expect(seen).toEqual([['conversation.message.user-text', '/original-id', ['original-id']]])
    fireEvent.click(screen.getByRole('button', { name: 'copy' }))
    await waitFor(() => { expect(writeText).toHaveBeenCalledWith('/original-id') })
  })
  it('offers the same extension for the immediate submission echo and uses native text when declined', () => {
    const renderUserText: NonNullable<ChatNodeOwnerProps['renderUserText']> = (_key, owner) => <span>{`preview: ${(owner as UserTextOwner).text}`}</span>
    const props = { submission: { text: '/original-id', attachments: [], placement: 'transcript', time: Date.now() },
      renderUserText, renderMessageImages: () => null, t: (key: string) => key }
    const f = render(<PendingSubmissionBubble {...props as unknown as ComponentProps<typeof PendingSubmissionBubble>} />)
    expect(screen.getByText('preview: /original-id')).toBeTruthy()
    const decline: NonNullable<ChatNodeOwnerProps['renderUserText']> = (_key, _owner, options) => options?.fallback ?? null
    const next = { ...props, renderUserText: decline } as unknown as ComponentProps<typeof PendingSubmissionBubble>
    f.rerender(<PendingSubmissionBubble {...next} />)
    expect(screen.getByText('/original-id')).toBeTruthy()
  })
})
