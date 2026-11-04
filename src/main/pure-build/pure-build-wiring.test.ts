import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripComments } from '../../shared/source-scan/source-tree-scan'

const SRC = join(__dirname, '../..')
const read = (file: string): string => stripComments(readFileSync(join(SRC, file), 'utf8'))
const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const token = (text: string): RegExp => new RegExp(`(?<![\\w$])${esc(text)}(?![\\w$])`)

/** Wiring zyx/orca-pure switched off: [file under src/, identifier absent outside comments]. */
const REMOVED: readonly (readonly [string, string])[] = [
  // O1 diagnostics and telemetry observers
  ['renderer/src/main.tsx', 'react-devtools-commit-hook-shim'],
  ['renderer/src/main.tsx', 'react-commit-cascade-observer'],
  ['renderer/src/main.tsx', 'installTypingLatencyDiagnostic'],
  ['main/startup/main-process-ready-foundation.ts', 'installMainThreadHangWatchdog'],
  ['main/startup/main-process-ready-foundation.ts', 'preservePreviousHangDetection'],
  ['main/startup/main-process-observers.ts', 'initTelemetry'],
  ['main/startup/main-process-observers.ts', 'initCohortClassifier'],
  ['main/startup/main-process-observers.ts', 'initOnboardingCohortClassifier'],
  ['main/startup/main-process-observers.ts', 'reportPreviousHangDetection'],
  ['main/startup/main-window-controller.ts', 'trackAppOpenedOnce'],
  ['main/startup/main-process-ready-runtime.ts', 'startPreGoneCrashSampling'],
  ['main/startup/main-process-ready-runtime.ts', 'WslUsageReporter'],
  ['main/startup/main-process-preflight.ts', 'startEventLoopDelayProbe'],
  ['main/startup/main-process-preflight.ts', 'startEventLoopStallProbe'],
  ['main/startup/main-process-preflight.ts', 'startMainThreadChurnProbe'],
  ['main/startup/main-process-preflight.ts', 'setSpawnObserver'],
  // O2 managed hook registry
  ['main/startup/main-process-ready-runtime.ts', 'refreshInstalledOpenCodeStatusPlugins'],
  // O13 onboarding, tips, tours, setup guide, star prompts
  ['renderer/src/App.tsx', 'useOnboardingAndFeatureTips'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'SetupGuideModal'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'FeatureWallModal'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'FeatureTipsModal'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'ContextualTourOverlay'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'SetupGuideTelemetryObserver'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'OnboardingFlow'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'StarNagToastHost'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'StarNagAgentValueMomentObserver'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'TelemetryFirstLaunchSurface'],
  ['renderer/src/app-shell/AppNotificationCards.tsx', 'StarNagCard'],
  ['renderer/src/components/sidebar/SidebarNav.tsx', 'SetupGuideSidebarEntry'],
  ['renderer/src/hooks/ipc-events/settings-sidebar-ipc-bridge.ts', 'onOpenSetupGuide'],
  ['renderer/src/hooks/ipc-events/settings-sidebar-ipc-bridge.ts', 'onOpenFeatureTour'],
  [
    'renderer/src/components/settings/page/settings-page-renderer.tsx',
    'renderSetupGuideSettingsSection'
  ],
  ['main/menu/register-app-menu.ts', 'featureTourItem'],
  ['main/menu/register-app-menu.ts', 'setupGuideItem'],
  ['main/startup/main-process-ready-runtime.ts', 'starNag.start()'],
  // O17 prototype pages and agent dashboard
  ['renderer/src/app-shell/AppWorkspaceShell.tsx', 'ActivityPrototypePage'],
  ['renderer/src/app-shell/AppWorkspaceShell.tsx', 'ArtifactsPage'],
  ['renderer/src/app-shell/AppBackgroundServices.tsx', 'DashboardPopoutBridge'],
  ['renderer/src/components/sidebar/SidebarNav.tsx', 'AgentDashboardSidebarEntry'],
  ['renderer/src/components/sidebar/SidebarNav.tsx', 'openArtifactsPage'],
  ['renderer/src/components/sidebar/index.tsx', 'AgentDashboardSidebarHost'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'WorkspaceCleanupDialog'],
  [
    'renderer/src/components/status-bar/resource-usage-popover-body.tsx',
    'onClick={handleOpenWorkspaceCleanup}'
  ],
  [
    'renderer/src/components/settings/advanced/ExperimentalPane.tsx',
    'AgentDashboardExperimentalSetting'
  ],
  [
    'renderer/src/components/settings/page/settings-page-renderer.tsx',
    'renderArtifactsSettingsSection'
  ],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerDashboardPopoutHandlers']
]
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
  ['main/startup/main-process-runtime-launch.ts', 'startDesktopPushService'],
  ['renderer/src/main.tsx', "installRendererCrashDiagnostics('main', { sampleMemory: false })"],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerTelemetryHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerDiagnosticsHandlers'],
  ['main/startup/main-process-ready-runtime.ts', 'recordProcessGoneCrash'],
  ['main/startup/main-process-preflight.ts', 'logStartupDiagnostic'],
  ['main/startup/main-process-ready-runtime.ts', 'startCodexHooks'],
  ['main/startup/main-process-ready-runtime.ts', 'reconcileStartupManagedAgentHooks'],
  ['main/startup/main-process-ready-runtime.ts', 'hydrateAgentCliShellPath'],
  ['main/ipc/pty/host-env/assembly.ts', 'piTitlebarExtensionService'],
  ['main/startup/main-process-ready-runtime.ts', 'starNag.registerIpcHandlers()'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerOnboardingHandlers'],
  ['main/updater/nudges/updater-nudge.ts', 'SELF_BUILT_BUILD'],
  ['main/updater/lifecycle/updater-setup.ts', 'SELF_BUILT_BUILD'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'isDashboardPopoutRenderer']
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
