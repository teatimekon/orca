import type {
  PiWebEnsureResult,
  PiWebRow,
  PiWebStatusDelta
} from '../../shared/pi-web/pi-web-status-types'

export type PiWebApi = {
  getSnapshot: () => Promise<PiWebRow[]>
  ensureServer: () => Promise<PiWebEnsureResult>
  dismiss: (sessionId: string) => Promise<void>
  onStatusChanged: (callback: (delta: PiWebStatusDelta) => void) => () => void
  onOpenSession: (
    callback: (payload: { worktreeId: string; sessionId: string }) => void
  ) => () => void
}
