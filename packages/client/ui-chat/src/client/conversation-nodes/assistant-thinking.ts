/** Present leading provider thinking delimiters as reasoning without changing the Session log. */
import type { AssistantBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'

const OPEN = /^<(thinking|think)>/iu
const OPENINGS = ['<thinking>', '<think>']

function incompleteOpening(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.length > 0 && OPENINGS.some(tag => tag.startsWith(lower))
}

function withoutPendingClose(text: string, closing: string, streaming: boolean): string {
  const lower = text.toLowerCase()
  for (let size = Math.min(closing.length - 1, text.length); size >= (streaming ? 1 : 3); size--) {
    if (lower.endsWith(closing.slice(0, size))) return text.slice(0, -size)
  }
  return text
}

function thinkingText(text: string, streaming: boolean): AssistantBlock[] | undefined {
  let remaining = text.trimStart()
  if (!OPEN.test(remaining)) {
    return streaming && incompleteOpening(remaining) ? [{ kind: 'reasoning', text: '' }] : undefined
  }
  const result: AssistantBlock[] = []
  for (;;) {
    const match = OPEN.exec(remaining.trimStart())
    if (match === null) {
      if (streaming && incompleteOpening(remaining.trimStart())) result.push({ kind: 'reasoning', text: '' })
      else if (remaining !== '') result.push({ kind: 'text', text: remaining })
      return result
    }
    const body = remaining.trimStart().slice(match[0].length)
    const closing = match[0].replace('<', '</').toLowerCase()
    const end = body.toLowerCase().indexOf(closing)
    result.push({ kind: 'reasoning', text: end < 0 ? withoutPendingClose(body, closing, streaming) : body.slice(0, end) })
    if (end < 0) return result
    remaining = body.slice(end + closing.length)
  }
}

/**
 * Interpret only bare think/thinking wrappers at the start of an Assistant text block.
 * Fences, inline code, quotes, escaped markup and embedded prose tags remain literal.
 * @param blocks - Assistant presentation blocks, not user messages or tool results.
 * @param streaming - withhold incomplete opening/closing delimiters during live display.
 * @returns normalized blocks, retaining the input identity when nothing changes.
 */
export function normalizeThinkingBlocks(blocks: readonly AssistantBlock[], streaming: boolean): readonly AssistantBlock[] {
  let changed = false
  const result: AssistantBlock[] = []
  for (const block of blocks) {
    const parts = block.kind === 'text' ? thinkingText(block.text, streaming) : undefined
    if (parts === undefined) result.push(block)
    else { changed = true; result.push(...parts) }
  }
  return changed ? result : blocks
}
