/**
 * Thinking passback repair for the OpenAI Chat Completions wire.
 *
 * DeepSeek-style thinking endpoints (the official API, and vLLM / SGLang
 * deployments running the DeepSeek chat template) stream reasoning as
 * `reasoning_content` and require that field BACK on every assistant message
 * of the current tool-call round; the request is refused otherwise —
 * `400 messages[N].reasoning_content is required for thinking tool-call
 * history` — and the round dies mid-work. pi-ai replays the field for every
 * step that produced reasoning (`thinkingSignature: 'reasoning_content'`), but
 * a step the endpoint answered WITHOUT any reasoning (an empty thinking block
 * some deployments emit for a trivial tool call) leaves a hole in the history
 * that pi-ai cannot fill: it only writes the field for non-empty thinking.
 *
 * This fills the holes with `""` — presence is what the check wants — but ONLY
 * in a request that already carries `reasoning_content` on some assistant
 * message: an endpoint that never spoke the field never sees it (OpenAI
 * proper rejects unknown message keys). Wired through pi-ai's `onPayload`
 * hook, which sees the exact wire object before it is sent.
 * @module dsh-llm-pi-ai/passback
 */

/** A Chat Completions request as pi-ai builds it; only the parts read here. */
interface WireRequestLike {
  messages?: unknown
}

interface WireMessageLike {
  role?: unknown
  tool_calls?: unknown
  reasoning_content?: unknown
}

function isWireMessage(value: unknown): value is WireMessageLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Fill `reasoning_content: ""` on assistant tool-call messages that lack it,
 * when the request already speaks the field. Mutates the payload in place.
 * @param payload - the wire request pi-ai is about to send.
 * @returns how many messages were filled (0 when the request is left alone).
 */
export function fillReasoningPassback(payload: unknown): number {
  if (typeof payload !== 'object' || payload === null) return 0
  const messages = (payload as WireRequestLike).messages
  if (!Array.isArray(messages)) return 0
  const wire = messages.filter(isWireMessage)
  const speaksReasoning = wire.some(message =>
    message.role === 'assistant' && typeof message.reasoning_content === 'string' && message.reasoning_content.length > 0)
  if (!speaksReasoning) return 0
  let filled = 0
  for (const message of wire) {
    if (message.role !== 'assistant') continue
    if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) continue
    if (typeof message.reasoning_content === 'string') continue
    message.reasoning_content = ''
    filled += 1
  }
  return filled
}
