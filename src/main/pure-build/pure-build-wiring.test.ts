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
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerDashboardPopoutHandlers'],
  ['renderer/src/components/settings/navigation/SettingsSidebar.tsx', 'SettingsSetupGuideNavRow'],
  ['renderer/src/hooks/ipc-events/workspace-shortcut-ipc-bridge.ts', 'onToggleAgentDashboard'],
  // O22 connector cloud, artifact share, ephemeral VM UI
  ['main/startup/main-process-runtime-launch.ts', 'installDesktopConnectorCloud'],
  ['main/startup/main-process-runtime-launch.ts', 'connectDesktopConnectorCloud'],
  ['main/startup/main-process-runtime-service.ts', 'ArtifactCloudService'],
  [
    'renderer/src/components/browser-pane/assemble-chrome/browser-page-toolbar.tsx',
    'ArtifactPublishButton'
  ],
  ['renderer/src/components/native-chat/NativeChatInlineVisual.tsx', 'ArtifactPublishButton'],
  [
    'renderer/src/components/browser-pane/workspace-doc/HtmlDocPreview.tsx',
    'buildDocPreviewShareControl'
  ],
  ['renderer/src/components/editor/EditorPanel.tsx', 'createActiveArtifactRequest'],
  [
    'renderer/src/components/settings/advanced/ExperimentalPane.tsx',
    'EphemeralVmsExperimentalSetting'
  ],
  // O4 background port scanner and port surfaces
  ['renderer/src/app-shell/AppBackgroundServices.tsx', 'WorkspacePortScanner'],
  ['renderer/src/components/status-bar/StatusBarSurface.tsx', 'PortsStatusSegment'],
  ['renderer/src/components/right-sidebar/PortsPanel.tsx', 'HostScopedPortsPanel'],
  // O5 AI Vault background work and panels
  ['main/startup/main-process-runtime-service.ts', 'installChildSessionSearchService'],
  ['renderer/src/app-shell/AppBackgroundServices.tsx', 'AiVaultTabTitleSyncGate'],
  ['renderer/src/components/right-sidebar/right-sidebar-panel-content.tsx', 'AiVaultSidebarPanel'],
  [
    'renderer/src/components/right-sidebar/use-right-sidebar-activity-items.ts',
    'AgentSessionHistoryIcon'
  ],
  [
    'renderer/src/components/settings/page/settings-page-renderer.tsx',
    'renderSessionHistorySettingsSection'
  ],
  // O22 follow-up: Cloud VM settings openers
  [
    'renderer/src/components/settings/runtime-environments/runtime-servers-header-actions.tsx',
    'ephemeral-vms'
  ],
  [
    'renderer/src/components/settings/virtual-machines/runtimes/CloudVmSetupGuide.tsx',
    'ephemeral-vms'
  ],
  // O4 follow-up: dead Ports switches
  ['renderer/src/components/status-bar/StatusBarVisibilityMenu.tsx', 'Plug'],
  [
    'renderer/src/components/settings/appearance/appearance-status-bar-search.ts',
    'portsToggleDescription'
  ]
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
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'isDashboardPopoutRenderer'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerOrcaProfileHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerEphemeralVmHandlers'],
  ['main/startup/main-process-runtime-launch.ts', 'installCloudSessionShutdownFlush'],
  ['main/runtime/mobile-cloud-relay/relay-auth-context.ts', 'readFreshOrcaCloudSession'],
  ['renderer/src/lib/sidebar-worktree-activation.ts', 'resumeWorkspace'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerWorkspacePortHandlers'],
  ['renderer/src/components/right-sidebar/PortsPanel.tsx', 'SshPortsPanel'],
  [
    'renderer/src/components/browser-pane/new-tab/use-browser-new-tab-servers.ts',
    'refreshWorkspacePortScanForTarget'
  ],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerAiVaultHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerAiVaultSearchHandlers'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'AiVaultSessionHistoryDialog'],
  [
    'renderer/src/components/native-chat/use-native-chat-resume-command.ts',
    'openAgentSessionHistoryModal'
  ],
  ['renderer/src/app-shell/app-command-handlers.ts', 'sidebar.ports.toggle']
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
