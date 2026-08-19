import { describe, expect, it } from 'vitest'
import { fillReasoningPassback } from '../src/passback.ts'

/** A DeepSeek-style thinking round: three tool-call steps, the middle one answered without reasoning. */
function thinkingRound(): { messages: Record<string, unknown>[] } {
  return {
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'go' },
      { role: 'assistant', content: '', reasoning_content: 'first', tool_calls: [{ id: 'a', type: 'function', function: { name: 'read', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'a', content: 'ok' },
      { role: 'assistant', content: 'now write', tool_calls: [{ id: 'b', type: 'function', function: { name: 'write', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'b', content: 'ok' },
      { role: 'assistant', content: '', reasoning_content: 'third', tool_calls: [{ id: 'c', type: 'function', function: { name: 'read', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c', content: 'ok' },
    ],
  }
}

describe('fillReasoningPassback', () => {
  it('fills the hole in a thinking tool-call history with an empty reasoning_content', () => {
    const payload = thinkingRound()
    expect(fillReasoningPassback(payload)).toBe(1)
    expect(payload.messages[4]).toMatchObject({ role: 'assistant', reasoning_content: '' })
    // Steps that had reasoning keep theirs verbatim.
    expect(payload.messages[2]).toMatchObject({ reasoning_content: 'first' })
    expect(payload.messages[6]).toMatchObject({ reasoning_content: 'third' })
  })

  it('leaves a request alone when no assistant message speaks reasoning_content', () => {
    const payload = {
      messages: [
        { role: 'user', content: 'go' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'read', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'a', content: 'ok' },
      ],
    }
    expect(fillReasoningPassback(payload)).toBe(0)
    expect('reasoning_content' in payload.messages[1]!).toBe(false)
  })

  it('never touches assistant messages without tool calls, or non-assistant roles', () => {
    const payload = {
      messages: [
        { role: 'user', content: 'go' },
        { role: 'assistant', content: 'plain answer' },
        { role: 'assistant', content: '', reasoning_content: 'r', tool_calls: [{ id: 'a', type: 'function', function: { name: 'x', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'a', content: 'ok' },
      ],
    }
    expect(fillReasoningPassback(payload)).toBe(0)
    expect('reasoning_content' in payload.messages[1]!).toBe(false)
    expect('reasoning_content' in payload.messages[3]!).toBe(false)
  })

  it('tolerates payloads that are not a Chat Completions request', () => {
    expect(fillReasoningPassback(undefined)).toBe(0)
    expect(fillReasoningPassback(null)).toBe(0)
    expect(fillReasoningPassback({ input: [] })).toBe(0)
    expect(fillReasoningPassback({ messages: 'nope' })).toBe(0)
  })
})
