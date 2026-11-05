import type {
  PiWebBindRequest,
  PiWebEffectiveConfig,
  PiWebEnsureResult,
  PiWebRow,
  PiWebStatusDelta
} from '../../shared/pi-web/pi-web-status-types'

export type PiWebApi = {
  getSnapshot: () => Promise<PiWebRow[]>
  ensureServer: () => Promise<PiWebEnsureResult>
  /** The config the bridge uses, with the fields ORCA_PI_WEB_* variables override. */
  getEffectiveConfig: () => Promise<PiWebEffectiveConfig>
  dismiss: (sessionId: string) => Promise<void>
  /** An Orca browser tab of the workspace shows the session; only bound sessions get sidebar rows. */
  bind: (request: PiWebBindRequest) => Promise<void>
  /** The pi-web server the status stream connected to last, or null before it ever connected. */
  getServerUrl: () => Promise<string | null>
  onServerUrlChanged: (callback: (url: string) => void) => () => void
  onStatusChanged: (callback: (delta: PiWebStatusDelta) => void) => () => void
  onOpenSession: (
    callback: (payload: { worktreeId: string; sessionId: string }) => void
  ) => () => void
}
