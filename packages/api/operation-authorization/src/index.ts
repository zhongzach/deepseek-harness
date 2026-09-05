/** Fail-closed admission shared by independently mounted Remote owners. */
import type { Context } from '@deepseek-ai/cordis'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { ApiAuthorizationOperation } from './types.ts'
export type * from './types.ts'

/** Public-safe refusal; arbitrary policy exceptions never enter the wire message. */
export class ApiAuthorizationError extends Error {
  /** Deployment-owned public reason code used by recovery controls. */
  readonly code: string
  /** Optional public recovery metadata, excluding credentials and provider response bodies. */
  readonly details: Record<string, unknown> | undefined
  /** @param error - public reason without credentials or provider response bodies. */
  constructor(error: { code: string; message: string; details?: Record<string, unknown> }) {
    super(error.message)
    this.name = 'ApiAuthorizationError'
    this.code = error.code
    this.details = error.details
  }
}

/**
 * Await serial policy admission before the owning API executes an operation.
 * @param ctx - operation-owning Host context.
 * @param operation - non-secret metadata detached before policy dispatch.
 * @returns once every listener allows the operation.
 * @throws RemoteError on refusal or unavailable authorization.
 */
export async function authorizeApiOperation(ctx: Context, operation: ApiAuthorizationOperation): Promise<void> {
  try {
    await ctx.serial('api/authorize-operation', structuredClone(operation))
  } catch (error: unknown) {
    if (error instanceof ApiAuthorizationError) {
      throw new RemoteError('api/operation-denied', error.message, {
        reasonCode: error.code, retryable: false,
        ...(error.details === undefined ? {} : { reasonDetails: error.details }),
      })
    }
    throw new RemoteError('api/operation-denied', 'Unable to confirm permission for this operation. Please refresh and try again.', {
      reasonCode: 'AUTHORIZATION_UNAVAILABLE', retryable: false,
    })
  }
}
