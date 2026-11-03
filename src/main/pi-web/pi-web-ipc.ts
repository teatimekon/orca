import { ipcMain } from 'electron'
import { PI_WEB_IPC } from '../../shared/pi-web/pi-web-status-types'
import type { PiWebBridge } from './pi-web-bridge'

export function registerPiWebIpcHandlers(bridge: PiWebBridge): void {
  ipcMain.handle(PI_WEB_IPC.getSnapshot, () => bridge.getSnapshot())
  ipcMain.handle(PI_WEB_IPC.ensureServer, () => bridge.ensureServer())
  ipcMain.handle(PI_WEB_IPC.dismiss, (_event, sessionId: unknown) => {
    if (typeof sessionId === 'string' && sessionId) {
      bridge.dismiss(sessionId)
    }
  })
}
