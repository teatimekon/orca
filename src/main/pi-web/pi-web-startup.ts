import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getTrustedUIRendererWindow } from '../ipc/ui'
import type { Store } from '../persistence/loading-store/store'
import { PiWebBridge } from './pi-web-bridge'
import { resolvePiWebConfig } from './pi-web-config'
import { registerPiWebIpcHandlers } from './pi-web-ipc'
import { listPiWebWorktreePaths } from './pi-web-worktree-paths'

export function startPiWebBridge(store: Store): PiWebBridge {
  const bridge = new PiWebBridge({
    rowsFilePath: join(app.getPath('userData'), 'pi-web', 'rows.json'),
    getConfig: () => resolvePiWebConfig(store.getSettings().piWeb, process.env, homedir()),
    listWorktreePaths: () => listPiWebWorktreePaths(store),
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
