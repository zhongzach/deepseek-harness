/** Session creation and adoption rules for Agent preset identity. */

import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import { agentPresetProjectionDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import SessionStore, { SESSION_FORMAT_VERSION, SessionId, SessionLogOffset, SessionSeq } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { createSessionTestController, createSessionTestRemote, testSessionPersistence } from './test-remote.ts'

/** Booted contexts and their temp roots, torn down after each test. */
const contexts: Context[] = []
const tempDirs: string[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function stubAgent(session: Session): Agent {
  return { id: session.id, session, status: 'idle' } as unknown as Agent
}

function roster(ids: readonly string[]): unknown {
  const presetOf = (id: string): object => ({
    id,
    trust: 'system',
  })
  return {
    defaultId: ids[0],
    resolve: (id?: string) => {
      const wanted = id ?? ids[0] ?? ''
      if (!ids.includes(wanted)) {
        return Promise.reject(new RemoteError(
          'agent-preset/not-found',
          `agent-presets: preset "${wanted}" not found (available: ${ids.join(', ') || 'none'})`,
          { agentPreset: wanted, available: ids },
        ))
      }
      return Promise.resolve(presetOf(wanted))
    },
    mount: (_ctx: Context, id?: string) => Promise.resolve(presetOf(id ?? ids[0] ?? '')),
  }
}

async function harness(presets?: readonly string[]) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-session-preset-')))
  tempDirs.push(cwd)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  if (presets !== undefined) {
    ctx.provide('agentPresets', roster(presets) as never)
  }

  const factory: AgentFactory = {
    async createAgent(_ownerCtx, options) {
      const session = ctx.sessions.create(
        options.sessionId,
        options.meta === undefined ? {} : { meta: options.meta },
      )
      const agent = stubAgent(session)
      ;(agent as { ctx?: Context }).ctx = ctx
      await options.setup?.(ctx, agent)
      const unregister = await ctx.agents.register(agent)
      return { agent, dispose: async () => { await unregister() } }
    },
    async resume() {
      throw new Error('test harness has no persisted sessions')
    },
  }
  ctx.agents.setFactory(factory)
  const remote = createSessionTestRemote(ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }),
    cwd,
  })
  if (presets !== undefined) ctx.sessionProjections.register(agentPresetProjectionDefinition)
  return { ctx, remote, factory, cwd }
}

async function coldHarness(started = false, raceStartsTurn = false) {
  const f = await harness(['standard'])
  const id = SessionId('missing-preset-session')
  const header: SessionHeader = {
    id, version: SESSION_FORMAT_VERSION, createdAt: 1, cwd: f.cwd, isSeeded: false,
    agentPreset: 'removed-product-preset',
  }
  let events: readonly SessionEvent[] = started
    ? [{ type: 'turn/start', seq: SessionSeq(0), time: 1, data: { turn: 1 } }]
    : []
  f.ctx.provide('sessionPersistence', testSessionPersistence(f.ctx, {
    list: () => Promise.resolve([header]),
    stat: () => Promise.resolve({ header, revision: SessionPersistenceRevision(`stored:${String(events.length)}`) }),
    inspect: () => Promise.resolve({ meta: header, events }),
  }) as never)
  let unload = async (): Promise<void> => {}
  let resumeCount = 0
  f.factory.resume = async (_ownerCtx, options) => {
    resumeCount += 1
    const session = f.ctx.sessions.prepare(options.resumeSessionId, {
      eventState: 'detached',
      seed: structuredClone([...events]),
      meta: { ...header },
      inheritedEventCount: SessionLogOffset(0),
    })
    if (raceStartsTurn) session.append('turn/start', { turn: 1 })
    const agent = stubAgent(session)
    const agentCtx = f.ctx.extend({ agent })
    ;(agent as { ctx?: Context }).ctx = agentCtx
    const commit = await options.setup?.(agentCtx, agent)
    commit?.commit()
    const detach = f.ctx.sessions.enter(session)
    f.ctx.sessions.announce(session)
    const unregister = f.ctx.agents.register(agent)
    events = session.snapshotEvents()
    unload = async () => { await unregister(); detach() }
    return { agent, dispose: () => unload() }
  }
  const controller = createSessionTestController(f.ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }), cwd: f.cwd,
  })
  return { ...f, controller, id, readEvents: () => events, unload: () => unload(), resumes: () => resumeCount }
}

describe('blank stored Session with an unavailable preset', () => {
  it.each(['resolve', 'create'] as const)('records the default through %s and resumes it durably', async (entry) => {
    const f = await coldHarness()
    const result = entry === 'create'
      ? await f.remote.create({ sessionId: f.id })
      : await f.controller.resolveAgent(f.id)
    expect(result).not.toHaveProperty('error')
    const switches = () => f.readEvents().filter(event => event.type === 'agent-preset/selected')
    expect(switches()).toHaveLength(1)
    expect(switches()[0]).toMatchObject({ data: { agentPreset: 'standard' } })
    await f.unload()
    const again = await f.controller.resolveAgent(f.id)
    expect('agent' in again).toBe(true)
    expect(switches()).toHaveLength(1)
    expect(f.resumes()).toBe(2)
  })

  it('refuses a started Session and leaves its log intact', async () => {
    const f = await coldHarness(true)
    const result = await f.controller.resolveAgent(f.id)
    expect(result).toHaveProperty('error')
    expect(f.resumes()).toBe(0)
    expect(f.readEvents().map(event => event.type)).toEqual(['turn/start'])
    expect(f.ctx.agents.get(f.id)).toBeUndefined()
  })

  it('refuses if the resumed artifact gained a turn after the blank observation', async () => {
    const f = await coldHarness(false, true)
    const result = await f.controller.resolveAgent(f.id)
    expect(result).toHaveProperty('error')
    expect(f.ctx.agents.get(f.id)).toBeUndefined()
    expect(f.readEvents()).toEqual([])
  })
})

describe('session.create Agent preset identity', () => {
  it('records the requested preset on the Session header', async () => {
    const { ctx, remote } = await harness(['standard', 'minimal'])

    const created = await remote.create({ sessionId: SessionId('s1'), agentPreset: 'minimal' })

    expect(created.ok).toBe(true)
    expect(ctx.sessions.get(SessionId('s1'))?.header.agentPreset).toBe('minimal')
  })

  it('records the roster default when the caller names no preset', async () => {
    const { ctx, remote } = await harness(['standard', 'minimal'])

    await remote.create({ sessionId: SessionId('s2') })

    expect(ctx.sessions.get(SessionId('s2'))?.header.agentPreset).toBe('standard')
  })

  it('rejects an unknown preset', async () => {
    const { remote } = await harness(['standard'])

    const response = await remote.create({ sessionId: SessionId('s3'), agentPreset: 'nope' })

    expect(response).toMatchObject({ ok: false, error: { code: 'agent-preset/not-found' } })
  })

  it('refuses to adopt a live Session under a different preset', async () => {
    const { remote } = await harness(['standard', 'minimal'])
    await remote.create({ sessionId: SessionId('s4'), agentPreset: 'minimal' })

    const response = await remote.create({ sessionId: SessionId('s4'), agentPreset: 'standard' })

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'agent-preset/conflict',
        details: {
          sessionId: 's4',
          requestedPreset: 'standard',
          existingPreset: 'minimal',
        },
      },
    })
  })

  it('adopts a live Session under the preset selected in its log', async () => {
    const { ctx, remote } = await harness(['standard', 'minimal'])
    await remote.create({ sessionId: SessionId('s4b'), agentPreset: 'standard' })
    ctx.sessions.get(SessionId('s4b'))?.append('agent-preset/selected', { agentPreset: 'minimal' })

    const adopted = await remote.create({ sessionId: SessionId('s4b'), agentPreset: 'minimal' })
    const stale = await remote.create({ sessionId: SessionId('s4b'), agentPreset: 'standard' })

    expect(adopted).toMatchObject({ ok: true, value: { agentPreset: 'minimal' } })
    expect(stale).toMatchObject({
      ok: false,
      error: { details: { existingPreset: 'minimal' } },
    })
  })

  it('adopts a live Session unchanged when the caller names no preset', async () => {
    const { remote } = await harness(['standard', 'minimal'])
    await remote.create({ sessionId: SessionId('s5'), agentPreset: 'minimal' })

    await expect(remote.create({ sessionId: SessionId('s5') }))
      .resolves.toMatchObject({ ok: true })
  })

  it('leaves the header preset-less when no roster is composed', async () => {
    const { ctx, remote } = await harness()

    await remote.create({ sessionId: SessionId('s6') })

    expect(ctx.sessions.get(SessionId('s6'))?.header.agentPreset).toBeUndefined()
  })

  it('explains why a preset-less Session cannot be adopted under one', async () => {
    const { remote } = await harness()
    await remote.create({ sessionId: SessionId('s7') })

    const response = await remote.create({ sessionId: SessionId('s7'), agentPreset: 'standard' })

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'agent-preset/conflict',
        details: {
          sessionId: 's7',
          requestedPreset: 'standard',
        },
      },
    })
    if (response.ok) throw new Error('unreachable')
    expect('existingPreset' in response.error.details).toBe(false)
    expect(response.error.message).toContain('records no agent preset')
  })
})
