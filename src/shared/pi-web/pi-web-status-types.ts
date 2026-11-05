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

/** A conversation an Orca browser tab of `worktreeId` showed; only bound sessions get rows. */
export type PiWebBinding = {
  sessionId: string
  worktreeId: string
  // Last bind or row change; an idle binding without a row expires from rows.json after a while.
  touchedAt: number
}

/**
 * `restored`: the page was already open when Orca started, so an existing binding wins
 * (it records which tab opened the conversation last). Otherwise the newest tab wins.
 */
export type PiWebBindRequest = { sessionId: string; worktreeId: string; restored: boolean }

export const PI_WEB_IPC = {
  statusChanged: 'piWeb:statusChanged',
  getSnapshot: 'piWeb:getSnapshot',
  ensureServer: 'piWeb:ensureServer',
  dismiss: 'piWeb:dismiss',
  openSession: 'piWeb:openSession',
  getEffectiveConfig: 'piWeb:getEffectiveConfig',
  bind: 'piWeb:bind',
  getServerUrl: 'piWeb:getServerUrl',
  serverUrlChanged: 'piWeb:serverUrlChanged'
} as const

export type PiWebSettings = {
  enabled: boolean
  serverUrl: string | null
  agentDir: string
  launchCwd: string
  launchCommand: string
}

/** Composed into GlobalSettings; absent in older profiles (resolved against defaults at use). */
export type PiWebGlobalSettings = { piWeb?: PiWebSettings }

export const DEFAULT_PI_WEB_SETTINGS: PiWebSettings = {
  enabled: true,
  serverUrl: null,
  agentDir: '~/.pi/agent',
  launchCwd: '~/Documents/code/pi-web',
  launchCommand: 'node bin/pi-web.js --no-open --port 30141 --hostname 0.0.0.0'
}

/** Each field an ORCA_PI_WEB_* variable sets for this session, with that variable's name. */
export type PiWebEnvOverrides = Partial<Record<keyof PiWebSettings, string>>

/** What the bridge actually uses: stored settings, defaults and env overrides resolved. */
export type PiWebEffectiveConfig = { config: PiWebSettings; envOverrides: PiWebEnvOverrides }
