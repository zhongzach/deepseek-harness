/** Deployment-policy metadata shared by independent API owners. */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Settings edits after their owning controller has removed secret values. */
export type SettingsAuthorizationPathOp =
  | { op: 'set'; path: readonly string[]; value?: unknown }
  | { op: 'unset'; path: readonly string[] }

/** Non-secret operation metadata; names remain stable across transport changes. */
export interface ApiAuthorizationOperationMap {
  'sessions.selectModel': { sessionId: Branded<'SessionId'>; provider: string; model: string; reasoningEffort?: string }
  'settings.update': { ns: string; patch: object; expectedRevision?: number }
  'settings.replace': { ns: string; section: object; expectedRevision?: number }
  'settings.mutate': { ns: string; ops: SettingsAuthorizationPathOp[]; expectedRevision?: number }
  'credentials.set': { ref: string }
  'credentials.unset': { ref: string }
  'llm.discoverModels': { settingsNs: string; provider?: string; baseURL?: string; api?: string }
}

/** One detached request descriptor; policy cannot rewrite the actual operation. */
export type ApiAuthorizationOperation = {
  [K in keyof ApiAuthorizationOperationMap]: { method: K; payload: ApiAuthorizationOperationMap[K] }
}[keyof ApiAuthorizationOperationMap]

/** Optional product grouping, independent from the model route. */
export interface ModelCatalogPresentation { sectionId: string; sectionName: string; sectionOrder?: number }
/** Deployment-owned follow-up affordance. */
export interface ModelAvailabilityAction { id: string; label: string }
/** A row's current deployment selection policy. */
export interface ModelAvailability { selectable: boolean; reason?: string; action?: ModelAvailabilityAction }
/** Policy-visible model fields; owners may supply additional provider metadata. */
export interface ApiCatalogModel {
  id: string
  name: string
  description?: string
  presentation?: ModelCatalogPresentation
  availability?: ModelAvailability
}
/** Detached catalog decorated before publication. */
export interface ApiModelCatalog {
  groups: { id: string; name: string; models: ApiCatalogModel[] }[]
  failures: { id: string; name: string; message: string }[]
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Authorize a call before persistence, selection or discovery.
     * @mode serial
     * @param operation - detached non-secret request metadata.
     */
    'api/authorize-operation'(operation: ApiAuthorizationOperation): void | Promise<void>
    /**
     * Decorate or restrict catalog rows without changing provider routing.
     * @mode serial
     * @param catalog - mutable, detached presentation catalog.
     */
    'api/model-catalog'(catalog: ApiModelCatalog): void | Promise<void>
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Policy refused an operation or could not confirm authorization. */
    'api/operation-denied': { reasonCode: string; retryable: false; reasonDetails?: Record<string, unknown> }
  }
}
