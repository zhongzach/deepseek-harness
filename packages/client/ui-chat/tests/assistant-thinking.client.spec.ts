import { describe, expect, it } from 'vitest'
import type { AssistantBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { normalizeThinkingBlocks } from '../src/client/conversation-nodes/assistant-thinking.ts'

const text = (value: string): AssistantBlock[] => [{ kind: 'text', text: value }]

describe('provider thinking wrappers in Assistant presentation', () => {
  it.each(['thinking', 'think', 'THINKING'])('presents %s as reasoning and retains the answer', (tag) => {
    expect(normalizeThinkingBlocks(text(`<${tag}>检查章节材料</${tag}>\n正文保留。`), false)).toEqual([
      { kind: 'reasoning', text: '检查章节材料' }, { kind: 'text', text: '\n正文保留。' },
    ])
  })

  it.each(['<', '<t', '<thi', '<thinking', '<thinking>检查', '<thinking>检查</thi'])('withholds streaming protocol fragments: %s', (value) => {
    const blocks = normalizeThinkingBlocks(text(value), true)
    expect(blocks.every(block => block.kind === 'reasoning')).toBe(true)
    expect(JSON.stringify(blocks)).not.toContain('<')
  })

  it('retains interrupted reasoning and consecutive wrappers without making them prose', () => {
    expect(normalizeThinkingBlocks(text('<thinking>第一步</thinking>\n<think>第二步</think>回答'), false)).toEqual([
      { kind: 'reasoning', text: '第一步' }, { kind: 'reasoning', text: '第二步' }, { kind: 'text', text: '回答' },
    ])
    expect(normalizeThinkingBlocks(text('<thinking>尚未结束</thi'), false)).toEqual([{ kind: 'reasoning', text: '尚未结束' }])
    expect(normalizeThinkingBlocks(text('<thinking>算式 x <'), false)).toEqual([{ kind: 'reasoning', text: '算式 x <' }])
  })

  it.each([
    '正文里出现 <thinking>标签</thinking>，不要删。',
    '```xml\n<thinking>代码样例</thinking>\n```',
    '`<thinking>行内代码</thinking>`',
    '> <thinking>引用内容</thinking>',
    '&lt;thinking&gt;转义样例&lt;/thinking&gt;',
    '<thinking class="example">真实 XML</thinking>',
    '<thi',
    '普通正文。',
  ])('preserves literal text on settlement: %s', (value) => {
    const blocks = text(value)
    expect(normalizeThinkingBlocks(blocks, false)).toBe(blocks)
  })

  it('does not mutate stored input, structured reasoning, images or tool-call arguments', () => {
    const blocks: AssistantBlock[] = [
      { kind: 'reasoning', text: '<thinking>已结构化的原文</thinking>' },
      { kind: 'tool-call', callId: 'c1', name: 'write', argsRaw: '{"content":"<thinking>文件原文</thinking>"}' },
      ...text('  <thinking>规划</thinking>回复'),
    ]
    const before = structuredClone(blocks)
    const result = normalizeThinkingBlocks(blocks, false)
    expect(blocks).toEqual(before)
    expect(result.slice(0, 2)).toEqual(blocks.slice(0, 2))
    expect(result.at(-1)).toEqual({ kind: 'text', text: '回复' })
  })
})
