import type { ChatNode } from './chat-nodes.ts'
import type { ProcessActivityCount } from './process-groups.ts'

/** Work recorded across one whole Turn, independent of its process groups. */
export interface TurnProcessActivity {
  /** Skill names this Turn's `skill` calls loaded, in first-call order. */
  readonly skills: readonly string[]
  /** Distinct-call categories of this Turn's Tool calls, ranked like a group summary. */
  readonly activity: readonly ProcessActivityCount[]
  /** Distinct paths this Turn's `read` calls named, in first-call order. */
  readonly readPaths: readonly string[]
}

/** Current process range and finalized answer boundary derived from one Turn. */
export interface TurnProcessSpec extends TurnProcessActivity {
  readonly turn: number
  /** Stable control-node anchor source, including currently ineligible evidence. */
  readonly controlAnchorSeq: number
  readonly processStartSeq: number
  readonly answerAnchorSeq: number | null
  readonly answerStep: number | null
  readonly inlineReasoning: boolean
  /** Reply-bearing durable Assistant messages before the final answer. */
  readonly messageCount: number
  /** Durable non-subagent Tool calls recorded by this Turn. */
  readonly toolCallCount: number
  /** Tool calls whose configured name identifies a subagent delegation. */
  readonly subagentCount: number
}

const TURN_PROCESS_INDEPENDENT_KIND_LIST = [
  'system-prompt',
  'user',
  'steering',
  'turn-trigger',
  'turn-process',
  'turn-error',
  'turn-max-tokens',
  'turn-tail',
] as const satisfies readonly ChatNode['kind'][]

/** Chat Node kinds that remain independent of a Turn's process disclosure. */
export const TURN_PROCESS_INDEPENDENT_KINDS: ReadonlySet<string> = new Set(
  TURN_PROCESS_INDEPENDENT_KIND_LIST,
)

/** Tool names that put questions to the reader. */
export const QUESTION_TOOL_NAMES: ReadonlySet<string> = new Set(['ask_user_question', 'request_user_input'])

/**
 * Whether a Node is a Tool call that put questions to the reader. The
 * conversation keeps such a call in view: outside process groups and the
 * whole-Turn fold, like a reply.
 * @param node - Chat Node.
 * @returns whether the Node's root call is a question tool.
 */
export function isQuestionCall(node: ChatNode): boolean {
  if (node.kind !== 'tool-call') return false
  const root = node.data.root
  const name = 'name' in root ? root.name : root.call?.name
  return name !== undefined && QUESTION_TOOL_NAMES.has(name)
}

/**
 * Whether a Node stays in view however its Turn's process is folded.
 * @param node - Chat Node.
 * @returns whether the Node is outside the process range's disclosure.
 */
export function turnProcessIndependent(node: ChatNode): boolean {
  return TURN_PROCESS_INDEPENDENT_KINDS.has(node.kind) || isQuestionCall(node)
}

/**
 * Compare immutable Turn-process specifications by their published fields.
 * @param left - previous specification.
 * @param right - next specification.
 * @returns whether both values describe the same process presentation.
 */
export function sameTurnProcessSpec(left: TurnProcessSpec, right: TurnProcessSpec): boolean {
  return left.turn === right.turn
    && left.controlAnchorSeq === right.controlAnchorSeq
    && left.processStartSeq === right.processStartSeq
    && left.answerAnchorSeq === right.answerAnchorSeq
    && left.answerStep === right.answerStep
    && left.inlineReasoning === right.inlineReasoning
    && left.messageCount === right.messageCount
    && left.toolCallCount === right.toolCallCount
    && left.subagentCount === right.subagentCount
    && sameTurnProcessActivity(left, right)
}

/**
 * Compare the whole-Turn work two specifications record.
 * @param left - previous value.
 * @param right - next value.
 * @returns whether both record the same skills, categories, and files.
 */
export function sameTurnProcessActivity(left: TurnProcessActivity, right: TurnProcessActivity): boolean {
  return left.skills.length === right.skills.length
    && left.skills.every((skill, index) => skill === right.skills[index])
    && left.activity.length === right.activity.length
    && left.activity.every((value, index) => value.kind === right.activity[index]?.kind
      && value.count === right.activity[index].count)
    && left.readPaths.length === right.readPaths.length
    && left.readPaths.every((path, index) => path === right.readPaths[index])
}

/**
 * Recognize the shipped subagent delegation name and its configured variants.
 * Control tools use distinct names such as `send_message` and `list_agents`.
 * @param name - durable Tool-call name.
 * @returns whether the call creates or forks a subagent.
 */
export function isSubagentDelegationTool(name: string): boolean {
  return name === 'subagent' || name.startsWith('subagent_')
}

/**
 * Keep live, stopped, and failed Turns open.
 * @param node - Node carrying the owning Turn.
 * @returns whether whole-Turn collapse is unavailable.
 */
export function turnProcessAlwaysOpen(node: ChatNode | undefined): boolean {
  const location = node?.location
  if (location?.kind !== 'turn' && location?.kind !== 'step') return false
  const reason = location.turn.end?.data.reason.kind
  return location.turn.status === 'open' || reason === 'aborted' || reason === 'error'
}
