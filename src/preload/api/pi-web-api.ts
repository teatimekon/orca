import type {
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
  onStatusChanged: (callback: (delta: PiWebStatusDelta) => void) => () => void
  onOpenSession: (
    callback: (payload: { worktreeId: string; sessionId: string }) => void
  ) => () => void
}
