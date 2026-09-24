import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const built = ['lib/index.js', 'lib/worker.cjs']
  .every(path => existsSync(join(packageRoot, path)))

describe.skipIf(!built)('built migration verifier (plain node)', () => {
  it('publishes history and verifies it without runtime workspace imports', async () => {
    const script = `
      import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
      import { tmpdir } from 'node:os'
      import { join } from 'node:path'
      import { Worker } from 'node:worker_threads'
      import { Context } from '@deepseek-ai/cordis'
      import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
      import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'

      const root = await mkdtemp(join(tmpdir(), 'dsh-built-migration-'))
      const id = 'built-migration-worker'
      const directory = join(root, '_no-cwd', id)
      const ctx = new Context()
      try {
        await mkdir(directory, { recursive: true })
        await writeFile(join(directory, 'session.jsonl'), JSON.stringify({
          type: 'session', version: 0, id, createdAt: 1, delegationDepth: 0,
        }) + '\\n')
        await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
        const handle = await ctx.sessionPersistence.open(id, 'write')
        await handle.close()
        await ctx.sessionPersistence.flush()
        const currentPath = join(directory, 'session.v' + SESSION_FORMAT_VERSION + '.jsonl')
        const header = JSON.parse((await readFile(currentPath, 'utf8')).trim())
        await mkdir(join(root, 'lib'))
        await copyFile('package.json', join(root, 'package.json'))
        const workerPath = join(root, 'lib', 'worker.cjs')
        await copyFile('lib/worker.cjs', workerPath)
        async function verify(expectedEventCount, knownEventTypes = []) {
          const worker = new Worker(workerPath, { workerData: {
            path: currentPath, compression: 'none', expectedId: id, expectedEventCount,
            knownEventTypes,
          } })
          try {
            return await new Promise((resolve, reject) => {
              worker.once('message', resolve)
              worker.once('error', reject)
              worker.once('exit', code => reject(new Error('verifier exited before a result: ' + code)))
            })
          } finally {
            await worker.terminate()
          }
        }
        const verified = await verify(0)
        const refused = await verify(1)
        const eventType = 'deployment/worker-registration'
        const event = { type: eventType, seq: 0, time: 2, data: { label: 'retained' } }
        await writeFile(currentPath, [header, event].map(row => JSON.stringify(row)).join('\\n') + '\\n')
        const registered = await verify(1, [eventType])
        const unknown = await verify(1)
        const malformedRequests = [null, {}, [''], [7], [eventType, eventType]]
        const malformedRefusals = []
        for (const names of malformedRequests) {
          try {
            await verify(1, names)
            malformedRefusals.push(false)
          } catch (error) {
            malformedRefusals.push(error.message === 'migration verifier request is malformed')
          }
        }
        await writeFile(currentPath, [header, { ...event, seq: 3 }]
          .map(row => JSON.stringify(row)).join('\\n') + '\\n')
        const invalidSequence = await verify(1, [eventType])
        console.log(JSON.stringify({ id: header.id, version: header.version,
          verified: verified.ok, refused: refused.ok, refusal: refused.message,
          registered: registered.ok, unknown: unknown.ok,
          unknownRefusal: unknown.message.includes('unknown to this harness and not marked ignorable'),
          malformedRefusals, invalidSequence: invalidSequence.ok }))
      } finally {
        await ctx.fiber.dispose()
        await rm(root, { recursive: true, force: true })
      }
    `
    const { exitCode, stdout, stderr } = await execa(
      process.execPath,
      ['--input-type=module', '-e', script],
      {
        cwd: packageRoot, env: { NODE_PATH: undefined, NODE_OPTIONS: undefined },
        stdin: 'ignore', timeout: 30_000, killSignal: 'SIGKILL', reject: false,
      },
    )

    expect(exitCode, `stderr:\n${stderr}`).toBe(0)
    expect(JSON.parse(stdout.trim())).toEqual({
      id: 'built-migration-worker', version: SESSION_FORMAT_VERSION, verified: true, refused: false,
      refusal: 'current session generation contains 0 events, expected 1',
      registered: true, unknown: false, unknownRefusal: true,
      malformedRefusals: [true, true, true, true, true], invalidSequence: false,
    })
  })
})
