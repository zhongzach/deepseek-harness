/** Business data for Chat process groups; source Nodes remain in the Chat store. */
export type ProcessActivity = 'read' | 'readImage' | 'search' | 'write' | 'edit' | 'commands' | 'code'
  | 'webSearch' | 'webFetch' | 'subagents' | 'plan' | 'questions' | 'skills' | 'tools'

/** One category and its distinct-call count. */
export interface ProcessActivityCount {
  readonly kind: ProcessActivity
  readonly count: number
}

/** Distinct-call category ranking and the current live task detail. */
export interface ProcessActivitySummary {
  readonly counts: readonly ProcessActivityCount[]
  /** Distinct paths named by the range's `read` calls, in first-call order. */
  readonly readPaths: readonly string[]
  readonly running: ProcessActivity | undefined
  readonly runningDetail: string
  /** Present only while the selected live activity has not reached tool/call. */
  readonly preparing?: true
}

/** Presentation facts for one group between independent replies or input. */
export interface ProcessGroupData {
  readonly turn: number
  readonly closed: boolean
  readonly summary: ProcessActivitySummary
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationGroupDataMap {
    chat: ProcessGroupData
  }
}
