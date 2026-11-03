// Wire types mirror pi-web's lib/session-status-bus.ts field for field.
export type PiWebSessionRunStatus = 'working' | 'awaiting_input' | 'idle'

export type PiWebSessionState = {
  id: string
  cwd: string
  name: string | null
  parentSessionId: string | null
  status: PiWebSessionRunStatus
  aborted: boolean
  lastRunEndedAt: number | null
  lastRunAborted: boolean
}

export type PiWebStatusFrame =
  | { type: 'snapshot'; sessions: PiWebSessionState[] }
  | { type: 'status'; session: PiWebSessionState }
  | { type: 'removed'; id: string }
  | { type: 'completed'; id: string; cwd: string; name: string | null; endedAt: number }
  | { type: 'heartbeat' }

export type PiWebRowState = 'working' | 'blocked' | 'done'

export type PiWebRow = {
  sessionId: string
  worktreeId: string
  cwd: string
  name: string | null
  state: PiWebRowState
  stateStartedAt: number
  updatedAt: number
  // endedAt of the last run that raised a `completed` event; dedupes repeated frames.
  lastCompletedEndedAt?: number
}

export type PiWebAttentionEvent = {
  sessionId: string
  worktreeId: string
  name: string | null
  kind: 'completed' | 'needs-input'
}

export type PiWebStatusDelta = {
  upserts: PiWebRow[]
  removals: string[]
  events: PiWebAttentionEvent[]
}

export type PiWebEnsureResult = { ok: true; url: string } | { ok: false; reason: string }

export const PI_WEB_IPC = {
  statusChanged: 'piWeb:statusChanged',
  getSnapshot: 'piWeb:getSnapshot',
  ensureServer: 'piWeb:ensureServer',
  dismiss: 'piWeb:dismiss',
  openSession: 'piWeb:openSession'
} as const
