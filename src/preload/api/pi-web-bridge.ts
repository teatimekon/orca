import { ipcRenderer } from 'electron'
import {
  PI_WEB_IPC,
  type PiWebBindRequest,
  type PiWebEffectiveConfig,
  type PiWebEnsureResult,
  type PiWebRow,
  type PiWebStatusDelta
} from '../../shared/pi-web/pi-web-status-types'
import type { PreloadApi } from '../api-types'

export const piWebApi = {
  getSnapshot: (): Promise<PiWebRow[]> => ipcRenderer.invoke(PI_WEB_IPC.getSnapshot),
  ensureServer: (): Promise<PiWebEnsureResult> => ipcRenderer.invoke(PI_WEB_IPC.ensureServer),
  getEffectiveConfig: (): Promise<PiWebEffectiveConfig> =>
    ipcRenderer.invoke(PI_WEB_IPC.getEffectiveConfig),
  dismiss: (sessionId: string): Promise<void> => ipcRenderer.invoke(PI_WEB_IPC.dismiss, sessionId),
  bind: (request: PiWebBindRequest): Promise<void> => ipcRenderer.invoke(PI_WEB_IPC.bind, request),
  getServerUrl: (): Promise<string | null> => ipcRenderer.invoke(PI_WEB_IPC.getServerUrl),
  onServerUrlChanged: (callback: (url: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string): void => callback(url)
    ipcRenderer.on(PI_WEB_IPC.serverUrlChanged, listener)
    return () => ipcRenderer.removeListener(PI_WEB_IPC.serverUrlChanged, listener)
  },
  onStatusChanged: (callback: (delta: PiWebStatusDelta) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, delta: PiWebStatusDelta): void =>
      callback(delta)
    ipcRenderer.on(PI_WEB_IPC.statusChanged, listener)
    return () => ipcRenderer.removeListener(PI_WEB_IPC.statusChanged, listener)
  },
  onOpenSession: (
    callback: (payload: { worktreeId: string; sessionId: string }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { worktreeId: string; sessionId: string }
    ): void => callback(payload)
    ipcRenderer.on(PI_WEB_IPC.openSession, listener)
    return () => ipcRenderer.removeListener(PI_WEB_IPC.openSession, listener)
  }
} satisfies PreloadApi['piWeb']
