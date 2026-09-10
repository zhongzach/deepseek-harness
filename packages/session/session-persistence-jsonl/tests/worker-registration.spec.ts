import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  active: new Set<string>(),
  postMessage: vi.fn<(value: unknown) => void>(),
  close: vi.fn<() => void>(),
  verify: vi.fn<() => Promise<unknown>>(),
  dispose: vi.fn<() => void>(),
}))

vi.mock('node:worker_threads', () => ({
  parentPort: { postMessage: state.postMessage, close: state.close },
  workerData: {
    path: '/stage', compression: 'none', expectedId: 'session', expectedEventCount: 0,
    knownEventTypes: ['deployment/scoped-verification'],
  },
}))

vi.mock('@deepseek-ai/dsh-session', () => ({
  registerSessionEventType(type: string) {
    state.active.add(type)
    return () => {
      state.dispose()
      state.active.delete(type)
    }
  },
}))

vi.mock('../src/generation.ts', () => ({ verifyJsonlCurrentGeneration: state.verify }))

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  state.active.clear()
})

describe('migration verifier event registration ownership', () => {
  it.each([false, true])('releases registrations after verification settles (failure: %s)', async (failure) => {
    state.verify.mockImplementation(async () => {
      expect(state.active).toEqual(new Set(['deployment/scoped-verification']))
      if (failure) throw new Error('invalid generation')
      return { digest: 'verified' }
    })

    await import('../src/worker.ts')
    await vi.waitFor(() => { expect(state.close).toHaveBeenCalledOnce() })

    expect(state.postMessage).toHaveBeenCalledWith(expect.objectContaining({ ok: !failure }))
    expect(state.dispose).toHaveBeenCalledOnce()
    expect(state.active.size).toBe(0)
  })
})
