import { ipcMain } from 'electron'
import { PI_WEB_IPC, type PiWebBindRequest } from '../../shared/pi-web/pi-web-status-types'
import type { PiWebBridge } from './pi-web-bridge'

function readBindRequest(value: unknown): PiWebBindRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const fields: Record<string, unknown> = Object.fromEntries(Object.entries(value))
  const { sessionId, worktreeId, restored } = fields
  return typeof sessionId === 'string' &&
    sessionId &&
    typeof worktreeId === 'string' &&
    worktreeId &&
    typeof restored === 'boolean'
    ? { sessionId, worktreeId, restored }
    : null
}

export function registerPiWebIpcHandlers(bridge: PiWebBridge): void {
  ipcMain.handle(PI_WEB_IPC.getSnapshot, () => bridge.getSnapshot())
  ipcMain.handle(PI_WEB_IPC.ensureServer, () => bridge.ensureServer())
  ipcMain.handle(PI_WEB_IPC.getEffectiveConfig, () => bridge.getEffectiveConfig())
  ipcMain.handle(PI_WEB_IPC.getServerUrl, () => bridge.getServerUrl())
  ipcMain.handle(PI_WEB_IPC.dismiss, (_event, sessionId: unknown) => {
    if (typeof sessionId === 'string' && sessionId) {
      bridge.dismiss(sessionId)
    }
  })
  ipcMain.handle(PI_WEB_IPC.bind, (_event, payload: unknown) => {
    const request = readBindRequest(payload)
    if (request) {
      bridge.bind(request)
    }
  })
}
