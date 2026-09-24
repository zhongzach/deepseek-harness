import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { MockAdapter, maxTokensResponse, textResponse, toolCallResponse } from './mock-adapter.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'test': { kind: 'test' } & ContextFormed
  }
}

const roots: Context[] = []
afterEach(async () => { for (const ctx of roots.splice(0)) await ctx.fiber.dispose() })
async function setup(adapter: MockAdapter) {
  const ctx = new Context(); roots.push(ctx)
  await ctx.plugin(LlmRuntime); await ctx.plugin(SessionStore); await ctx.plugin(SessionProjections)
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] }); ctx.llm.registerAdapter(['mock'], adapter)
  const agent = await ctx.agentLoop.create(SessionId('output-limit-fixture'), { provider: 'mock', model: 'mock' })
  const run = async () => { agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'continue the requested work' }] })); await agent.whenIdle() }
  return { ctx, agent, run }
}

describe('agent/output-limit', () => {
  it('preserves the default terminal outcome without a recovery owner', async () => {
    const adapter = new MockAdapter([maxTokensResponse('partial')])
    const f = await setup(adapter); await f.run()
    expect(adapter.requests).toHaveLength(1)
    expect(f.agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'max-tokens' } } })
  })

  it('retries the same step after a policy adds durable recovery context', async () => {
    const adapter = new MockAdapter([maxTokensResponse('partial'), textResponse('completed')])
    const f = await setup(adapter)
    f.ctx.on('agent/output-limit', async ({ agent }) => {
      expect(agent.session.snapshotEvents().some(event => event.type === 'assistant/message')).toBe(true)
      agent.session.append('user/message', createUserMessage({ source: { kind: 'test' },
        content: [{ type: 'text', text: 'Continue only the unfinished part.' }],
      }), { surfaceOp: 'append' })
      return { kind: 'retry' }
    })
    await f.run()
    expect(adapter.requests).toHaveLength(2)
    expect(JSON.stringify(adapter.requests[1]?.messages)).toContain('Continue only the unfinished part.')
    const events = f.agent.session.snapshotEvents()
    expect(events.filter(event => event.type === 'step/start')).toHaveLength(1)
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  })

  it('rejects a retry that has no logged context change', async () => {
    const adapter = new MockAdapter([maxTokensResponse('partial'), textResponse('unused')])
    const f = await setup(adapter)
    f.ctx.on('agent/output-limit', async () => ({ kind: 'retry' }))
    await f.run()
    expect(adapter.requests).toHaveLength(1)
    expect(f.agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'error', error: { code: 'INVALID_RECOVERY' } } } })
  })

  it('lets cancellation win after the recovery callback', async () => {
    const adapter = new MockAdapter([maxTokensResponse('partial'), textResponse('unused')])
    const f = await setup(adapter)
    f.ctx.on('agent/output-limit', async ({ agent }) => { agent.cancel({ kind: 'user' }); return { kind: 'retry' } })
    await f.run()
    expect(adapter.requests).toHaveLength(1)
    expect(f.agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'aborted' } } })
  })

  it('never executes tool calls from a truncated response', async () => {
    const response = toolCallResponse('not-executed', 'write', { file_path: 'unwritten.txt', content: 'partial' })
    response[response.length - 1] = { type: 'finish', reason: { kind: 'max-tokens' } }
    const adapter = new MockAdapter([response])
    const f = await setup(adapter); await f.run()
    expect(f.agent.session.snapshotEvents().some(event => event.type === 'tool/call')).toBe(false)
  })
})
