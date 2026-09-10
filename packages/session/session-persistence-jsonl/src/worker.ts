/** Worker entry for current-generation physical and logical verification. */

import { parentPort, workerData } from 'node:worker_threads'
import { registerSessionEventType } from '@deepseek-ai/dsh-session'
import { verifyJsonlCurrentGeneration } from './generation.ts'
import type { JsonlExpectedPrefix } from './generation.ts'
import type { JsonlCompression } from './format.ts'

interface VerificationRequest {
  readonly path: string
  readonly compression: JsonlCompression
  readonly expectedId: string
  readonly expectedEventCount: number
  readonly expectedPrefix?: JsonlExpectedPrefix
  readonly knownEventTypes: readonly string[]
}

function parseRequest(value: unknown): VerificationRequest {
  if (typeof value !== 'object' || value === null) throw new Error('migration verifier request must be an object')
  const request = value as Partial<VerificationRequest>
  if (typeof request.path !== 'string'
    || request.compression !== 'none' && request.compression !== 'zstd'
    || typeof request.expectedId !== 'string'
    || !Number.isSafeInteger(request.expectedEventCount)
    || (request.expectedEventCount as number) < 0
    || !Array.isArray(request.knownEventTypes)
    || !request.knownEventTypes.every(type => typeof type === 'string' && type.length > 0)
    || new Set(request.knownEventTypes).size !== request.knownEventTypes.length
    || request.expectedPrefix !== undefined
      && (!Number.isSafeInteger(request.expectedPrefix.bytes)
        || request.expectedPrefix.bytes < 0
        || !/^[0-9a-f]{64}$/.test(request.expectedPrefix.digest))) {
    throw new Error('migration verifier request is malformed')
  }
  return request as VerificationRequest
}

if (parentPort === null) throw new Error('migration verifier requires a parent port')
const port = parentPort

const request = parseRequest(workerData)

async function verify(): Promise<void> {
  const disposeTypes = request.knownEventTypes.map(registerSessionEventType)
  try {
    const result = await verifyJsonlCurrentGeneration(
      request.path,
      request.compression,
      request.expectedId,
      request.expectedEventCount,
      request.expectedPrefix,
    )
    port.postMessage({ ok: true, result })
  } catch (error: unknown) {
    const failure = error instanceof Error ? error : new Error(String(error))
    port.postMessage({ ok: false, message: failure.message, stack: failure.stack })
  } finally {
    for (const dispose of disposeTypes) dispose()
    port.close()
  }
}

void verify()
