import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripComments } from '../../shared/source-scan/source-tree-scan'

const SRC = join(__dirname, '../..')
const read = (file: string): string => stripComments(readFileSync(join(SRC, file), 'utf8'))
const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const token = (text: string): RegExp => new RegExp(`(?<![\\w$])${esc(text)}(?![\\w$])`)

/** Wiring zyx/orca-pure switched off: [file under src/, identifier absent outside comments]. */
const REMOVED: readonly (readonly [string, string])[] = []
/** Wiring that must survive because kept code awaits it: [file, identifier present]. */
const KEPT: readonly (readonly [string, string])[] = [
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerWslHostHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerWslMoveWiring'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerWslDriveProjectHandlers'],
  ['main/startup/main-process-ready-foundation.ts', 'startWslMoveStartup'],
  ['main/startup/main-process-ready-foundation.ts', 'reconcileManagedWslCliRegistrations'],
  ['main/startup/main-process-ready-runtime.ts', 'startPiWebBridge'],
  ['renderer/src/hooks/ipc-events/app-lifetime-ipc-bridge.ts', 'registerPiWebIpcBridge'],
  ['renderer/src/components/settings/agents/AgentsPane.tsx', 'PiWebSettingsSection'],
  ['preload/index.ts', 'piWeb'],
  ['renderer/src/App.tsx', 'BrowserPagePrompts'],
  ['main/startup/first-window-startup-services.ts', 'startAgentHookServer'],
  ['main/startup/main-process-runtime-launch.ts', 'startDesktopRelayService'],
  ['main/startup/main-process-runtime-launch.ts', 'startDesktopPushService']
]
/** Platform-gated wiring: [file, guard text, identifier the guard precedes within 200 chars]. */
const GUARDED: readonly (readonly [string, string, string])[] = [
  [
    'main/startup/main-process-ready-foundation.ts',
    "process.platform === 'win32'",
    'startWslHostsPolicyLiveUpdates'
  ],
  [
    'main/startup/main-process-ready-runtime.ts',
    "process.platform === 'win32'",
    'runGatedWslMoveDesktopRewritePass'
  ],
  ['renderer/src/App.tsx', 'isWindowsUserAgent()', 'runWslMoveRendererStoreRewrites'],
  ['renderer/src/App.tsx', 'isWindowsUserAgent()', 'runWslDriveUncRendererStoreRewrites']
]

describe('zyx/orca-pure wiring', () => {
  for (const [file, symbol] of REMOVED) {
    it(`${file} no longer wires ${symbol}`, () => expect(read(file)).not.toMatch(token(symbol)))
  }
  for (const [file, symbol] of KEPT) {
    it(`${file} still wires ${symbol}`, () => expect(read(file)).toMatch(token(symbol)))
  }
  for (const [file, guard, symbol] of GUARDED) {
    it(`${file} gates ${symbol} behind ${guard}`, () =>
      expect(read(file)).toMatch(new RegExp(`${esc(guard)}[\\s\\S]{0,200}${token(symbol).source}`)))
  }
})
