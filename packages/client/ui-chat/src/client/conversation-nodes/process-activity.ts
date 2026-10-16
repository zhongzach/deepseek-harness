/** Tool-category and live-detail interpretation owned by Chat grouping. */
import type { ProcessActivity, ProcessActivityCount, ProcessActivitySummary } from '../contract/process-groups.ts'
import type { ChatNode } from '../contract/chat-nodes.ts'
import { isRunningTool } from '../contract/chat-nodes.ts'
import { QUESTION_TOOL_NAMES } from '../contract/turn-process.ts'
import type { ToolCallBlock } from '../contract/snapshot.ts'

/**
 * Classify one Tool call by its durable name.
 * @param name - Tool-call name.
 * @returns the process category the call counts toward.
 */
export function processActivityKind(name: string): ProcessActivity {
  if (name === 'read') return 'read'
  if (name === 'read_image') return 'readImage'
  if (name === 'grep' || name === 'glob' || name.endsWith('_inspect')) return 'search'
  if (name === 'write') return 'write'
  if (name === 'edit' || name === 'apply_patch') return 'edit'
  if (['bash', 'pwsh', 'exec_command', 'write_stdin'].includes(name) || name.startsWith('terminal_')) return 'commands'
  if (name === 'run_code') return 'code'
  if (name === 'web_search') return 'webSearch'
  if (name === 'web_fetch') return 'webFetch'
  if (name === 'subagent' || name.startsWith('subagent_')) return 'subagents'
  if (['todo_write', 'create_goal', 'update_goal', 'get_goal'].includes(name)) return 'plan'
  if (QUESTION_TOOL_NAMES.has(name)) return 'questions'
  if (name === 'skill') return 'skills'
  return 'tools'
}

const LIVE_TOOL_DETAIL_MAX_CHARS = 160
const LIVE_TOOL_DETAIL_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const LIVE_TOOL_DETAIL_KEYS = [
  'title', 'description', 'objective', 'task', 'task_name', 'name', 'question', 'questions', 'prompt', 'message',
  'command', 'cmd', 'queries', 'query', 'pattern', 'url', 'uri', 'file_path', 'path', 'target', 'action', 'status',
] as const

function normalizeLiveToolDetail(value: unknown): string {
  const text = typeof value === 'string'
    ? value
    : Array.isArray(value) && value.every(item => typeof item === 'string')
      ? value.join(', ')
      : ''
  const normalized = text.replace(/\s+/g, ' ').trim()
  const chars = Array.from(LIVE_TOOL_DETAIL_SEGMENTER.segment(normalized), part => part.segment)
  return chars.length <= LIVE_TOOL_DETAIL_MAX_CHARS
    ? normalized
    : `${chars.slice(0, LIVE_TOOL_DETAIL_MAX_CHARS - 1).join('').trimEnd()}…`
}

function questionDetail(value: unknown): string {
  if (!Array.isArray(value)) return ''
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const detail = normalizeLiveToolDetail(Reflect.get(item, 'question'))
    if (detail !== '') return detail
  }
  return ''
}

function liveReasoningDetail(nodes: readonly ChatNode[]): string {
  for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex--) {
    const node = nodes[nodeIndex]
    if (node?.kind !== 'assistant-step' || node.data.status !== 'running') continue
    for (let blockIndex = node.data.blocks.length - 1; blockIndex >= 0; blockIndex--) {
      const block = node.data.blocks[blockIndex]
      if (block?.kind !== 'reasoning') continue
      const paragraphs = block.text.split(/\r?\n[\t ]*\r?\n/)
      for (let paragraphIndex = paragraphs.length - 1; paragraphIndex >= 0; paragraphIndex--) {
        const detail = normalizeLiveToolDetail(paragraphs[paragraphIndex]?.replaceAll('**', ''))
        if (detail !== '') return detail
      }
    }
  }
  return ''
}

/**
 * Read the file a `read` call names.
 * @param argsRaw - Tool-call argument JSON, possibly partial.
 * @returns the trimmed `file_path` or `path` argument, or undefined when absent or unparsable.
 */
export function readCallPath(argsRaw: string): string | undefined {
  let args: unknown
  try {
    args = JSON.parse(argsRaw)
  } catch (_error: unknown) {
    // Partial arguments do not name a file yet.
    return undefined
  }
  if (args === null || typeof args !== 'object') return undefined
  for (const key of ['file_path', 'path']) {
    const value: unknown = Reflect.get(args, key)
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

/**
 * Read the skill a `skill` call loads.
 * @param argsRaw - Tool-call argument JSON, possibly partial.
 * @returns the trimmed `name` argument, or undefined when absent or unparsable.
 */
export function skillCallName(argsRaw: string): string | undefined {
  let args: unknown
  try {
    args = JSON.parse(argsRaw)
  } catch (_error: unknown) {
    // Partial arguments do not name a skill yet.
    return undefined
  }
  if (args === null || typeof args !== 'object') return undefined
  const name: unknown = Reflect.get(args, 'name')
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined
}

function liveToolDetail(name: string, argsRaw: string): string {
  let args: unknown
  try {
    args = JSON.parse(argsRaw)
  } catch (_error: unknown) {
    // Partial or free-form arguments have no safe one-line task detail.
    return normalizeLiveToolDetail(name)
  }
  if (args === null || typeof args !== 'object') return normalizeLiveToolDetail(name)
  for (const key of LIVE_TOOL_DETAIL_KEYS) {
    if (key in args) {
      const value: unknown = Reflect.get(args, key)
      const detail = key === 'questions' ? questionDetail(value) : normalizeLiveToolDetail(value)
      if (detail !== '') return detail
    }
  }
  return normalizeLiveToolDetail(name)
}

/**
 * Rank categories by distinct call count, breaking ties by first appearance.
 * @param counts - distinct-call counts in first-appearance order.
 * @returns the categories ordered for titles and summaries.
 */
export function rankProcessActivity(counts: ReadonlyMap<ProcessActivity, number>): ProcessActivityCount[] {
  return [...counts].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count)
}

/**
 * Rank categories by distinct call count, breaking ties by first appearance.
 * @param nodes - process members, including recursive tools.
 * @returns all ranked categories, the files read, and the latest running tool category and bounded task detail.
 */
export function processActivity(nodes: readonly ChatNode[]): ProcessActivitySummary {
  const counts = new Map<ProcessActivity, number>()
  const readPaths: string[] = []
  const seen = new Set<string>()
  let running: ProcessActivity | undefined
  let runningDetail = ''
  let runningTime = -Infinity
  let preparing: boolean | undefined
  const visit = (tool: ToolCallBlock): void => {
    if (seen.has(tool.callId)) return
    seen.add(tool.callId)
    const call = isRunningTool(tool) ? tool : tool.call
    if (call !== null) {
      const kind = processActivityKind(call.name)
      const argsRaw = 'argsRaw' in call ? call.argsRaw : undefined
      const path = kind === 'read' && argsRaw !== undefined ? readCallPath(argsRaw) : undefined
      if (path !== undefined && !readPaths.includes(path)) readPaths.push(path)
      if (isRunningTool(tool) && tool.time >= runningTime) {
        running = kind
        preparing = tool.phase === 'preparing'
        runningDetail = tool.phase === 'preparing'
          ? kind === 'tools' ? tool.name : ''
          : liveToolDetail(tool.name, tool.argsRaw)
        runningTime = tool.time
      }
      counts.set(kind, (counts.get(kind) ?? 0) + 1)
    }
    for (const child of tool.subCalls) visit(child)
  }
  for (const node of nodes) {
    if (node.kind === 'tool-call') visit(node.data.root)
  }
  if (running === undefined) runningDetail = liveReasoningDetail(nodes)
  return {
    counts: rankProcessActivity(counts),
    readPaths,
    running,
    runningDetail,
    ...preparing ? { preparing: true } : {},
  }
}
