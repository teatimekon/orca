import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getTrustedUIRendererWindow } from '../ipc/ui'
import type { Store } from '../persistence/loading-store/store'
import { PiWebBridge } from './pi-web-bridge'
import { resolvePiWebEffectiveConfig } from './pi-web-config'
import { registerPiWebIpcHandlers } from './pi-web-ipc'
import { listPiWebWorkspaceIds } from './pi-web-workspace-ids'

/** Starts the status bridge; on failure logs and returns null, since pi-web must never stop Orca starting. */
export function startPiWebBridge(store: Store): PiWebBridge | null {
  try {
    return createAndStartPiWebBridge(store)
  } catch (error) {
    console.error('[pi-web] status bridge failed to start', error)
    return null
  }
}

function createAndStartPiWebBridge(store: Store): PiWebBridge {
  const effectiveConfig = () =>
    resolvePiWebEffectiveConfig(store.getSettings().piWeb, process.env, homedir())
  const bridge = new PiWebBridge({
    rowsFilePath: join(app.getPath('userData'), 'pi-web', 'rows.json'),
    getConfig: () => effectiveConfig().config,
    getEnvOverrides: () => effectiveConfig().envOverrides,
    listWorkspaceIds: () => listPiWebWorkspaceIds(store),
    // Why: with no window yet the delta is dropped; the renderer hydrates through getSnapshot.
    sendToRenderer: (channel, payload) => {
      const win = getTrustedUIRendererWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload)
      }
    },
    onConfigChanged: (listener) => store.onSettingsChanged(() => listener())
  })
  bridge.start()
  registerPiWebIpcHandlers(bridge)
  return bridge
}
