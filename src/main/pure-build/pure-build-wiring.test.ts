import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripComments } from '../../shared/source-scan/source-tree-scan'
import { PURE_DELETED_PATHS, pureDeletedPathMatcher } from './pure-deleted-paths'

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
  ],
  // O20 emulator, computer use, dictation, pet, notebook kernels, theme import
  ['main/startup/main-process-ready-runtime.ts', 'EmulatorBridge'],
  [
    'main/ipc/register-core-handlers/register-core-handlers.ts',
    'registerEmulatorScrcpyKeyboardHandler'
  ],
  ['main/ipc/settings.ts', 'registerSettingsImportHandlers'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'DictationController'],
  ['renderer/src/app-shell/AppRootSurfaces.tsx', 'PetOverlay'],
  ['renderer/src/components/status-bar/StatusBarSurface.tsx', 'PetStatusSegment'],
  [
    'renderer/src/components/settings/page/settings-page-renderer.tsx',
    'renderDesktopCapabilitySettingsSections'
  ],
  [
    'renderer/src/components/settings/page/settings-page-renderer.tsx',
    'renderMobileEmulatorSettingsSection'
  ],
  ['renderer/src/components/settings/advanced/ExperimentalPane.tsx', 'experimentalPet'],
  // O18 browser extras (stream-remote kept by coordinator ruling)
  ['main/startup/main-process-ready-runtime.ts', 'AgentBrowserBridge'],
  ['main/startup/main-process-ready-foundation.ts', 'switchBrowserExtensionSupport'],
  ['renderer/src/App.tsx', 'BrowserExtensionInstallDialog'],
  ['renderer/src/App.tsx', 'BrowserWebAuthnAccountDialog'],
  [
    'renderer/src/components/settings/advanced/ExperimentalPane.tsx',
    'BrowserExtensionsExperimentalSetting'
  ],
  ['renderer/src/components/settings/browser/BrowserPane.tsx', 'BrowserExtensionsSection'],
  [
    'renderer/src/components/browser-pane/assemble-chrome/browser-page-toolbar.tsx',
    'BrowserImportHintButton'
  ],
  [
    'renderer/src/components/browser-pane/assemble-chrome/browser-page-toolbar.tsx',
    'BrowserExtensionToolbar'
  ],
  [
    'renderer/src/components/browser-pane/assemble-chrome/browser-page-viewport-overlays.tsx',
    'useBrowserAgentCursor'
  ],
  ['renderer/src/components/browser-pane/ClientHostedBrowserPagePane.tsx', 'useBrowserAgentCursor'],
  [
    'renderer/src/components/browser-pane/host-guest/use-browser-page-keyboard-shortcuts.ts',
    'onGrabModeToggle'
  ],
  [
    'renderer/src/components/browser-pane/assemble-chrome/browser-toolbar-menu-dropdown.tsx',
    'BrowserCookieImportDisclosure'
  ],
  ['main/browser/browser-webauthn-access.ts', 'requestBrowserWebAuthnAccount'],
  // O14b hosted source control
  ['renderer/src/app-shell/use-app-shell-services.ts', 'useVisibleHostedReviewRefresh'],
  ['renderer/src/app-shell/ActiveWorkspaceSyncGate.tsx', 'useVisibleReviewRefreshReporting'],
  ['renderer/src/app-shell/use-app-startup-hydration.ts', 'initGitHubCache'],
  ['renderer/src/components/right-sidebar/right-sidebar-panel-content.tsx', 'ChecksPanel'],
  [
    'renderer/src/components/right-sidebar/right-sidebar-panel-content.tsx',
    'FolderWorkspacePrChecksPanel'
  ],
  ['renderer/src/components/right-sidebar/use-right-sidebar-activity-items.ts', "id: 'checks'"],
  ['renderer/src/components/right-sidebar/use-right-sidebar-activity-items.ts', "id: 'pr-checks'"],
  [
    'renderer/src/components/settings/page/settings-git-task-section-renderers.tsx',
    'GitProviderApiBudgetPane'
  ],
  // O20 follow-up: emulator and computer-use openers
  [
    'renderer/src/components/tab-group/useTabGroupWorkspaceModel.ts',
    'mobileEmulatorEnabled !== false'
  ],
  [
    'renderer/src/components/tab-bar/use-tab-bar-runtime-model.ts',
    'mobileEmulatorEnabled !== false'
  ],
  [
    'renderer/src/components/settings/page/settings-interface-primary-section-renderers.tsx',
    'onOpenComputerUse'
  ],
  // O14a task page, Linear and Jira (deleted)
  ['renderer/src/app-shell/AppWorkspaceShell.tsx', 'TaskPage'],
  ['renderer/src/components/sidebar/SidebarNav.tsx', 'SidebarTaskNavButton'],
  ['renderer/src/app-shell/app-command-handlers.ts', 'openTaskPage'],
  ['renderer/src/hooks/ipc-events/workspace-shortcut-ipc-bridge.ts', 'openTaskPage'],
  ['renderer/src/components/sidebar/use-worktree-card-foundation.ts', 'openTaskPage'],
  ['renderer/src/components/sidebar/use-worktree-card-lifecycle-effects.ts', 'fetchLinearIssue'],
  [
    'renderer/src/components/sidebar/use-worktree-card-lifecycle-effects.ts',
    'consumeLinearIssueRead'
  ],
  ['renderer/src/components/sidebar/use-worktree-card-lifecycle-effects.ts', 'intervalMs'],
  ['renderer/src/components/settings/page/settings-git-task-section-renderers.tsx', 'TasksPane'],
  [
    'renderer/src/components/settings/page/settings-capability-section-renderers.tsx',
    'LinearAgentSkillPane'
  ],
  [
    'renderer/src/components/settings/page/settings-setup-workflow-section-renderers.tsx',
    'IntegrationsPane'
  ],
  ['renderer/src/hooks/settings-navigation-workflow-sections.ts', 'getTasksPaneSearchEntries'],
  [
    'renderer/src/hooks/settings-navigation-capability-sections.ts',
    'getLinearAgentSkillPaneSearchEntries'
  ],
  [
    'renderer/src/hooks/settings-navigation-capability-sections.ts',
    'getIntegrationsPaneSearchEntries'
  ],
  ['renderer/src/hooks/composer-state/composer-navigation-actions.ts', 'handleOpenJiraSettings'],
  [
    'renderer/src/components/settings/appearance/AppearanceWindowSidebarSection.tsx',
    'showTasksButton'
  ],
  ['renderer/src/store/index.ts', 'createLinearSlice'],
  ['renderer/src/store/index.ts', 'createJiraSlice'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerLinearHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerJiraHandlers'],
  [
    'main/ipc/register-core-handlers/register-core-handlers.ts',
    'registerJiraIssueSummaryGenerationHandlers'
  ],
  ['main/startup/main-process-ready-foundation.ts', 'installJiraImageProtocolHandler'],
  ['main/startup/privileged-custom-schemes.ts', 'JIRA_IMAGE_CUSTOM_SCHEME'],
  ['main/runtime/orca-runtime.ts', 'installRuntimeLinearCommandSurface'],
  ['main/runtime/construction/runtime-construction.ts', 'OrcaRuntimeWithLinearCommands'],
  ['main/runtime/runtime-edge-command-controller.ts', 'RuntimeJiraCommands'],
  ['main/menu/register-app-menu.ts', "onToggleAppearance('showTasksButton')"],
  ['preload/index.ts', 'linearApi'],
  ['preload/index.ts', 'jiraApi'],
  // O14b fix round 4
  [
    'renderer/src/hooks/settings-navigation-workflow-sections.ts',
    'getGitProviderApiBudgetSearchEntries'
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
  ['renderer/src/app-shell/app-command-handlers.ts', 'sidebar.ports.toggle'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerSpeechHandlers'],
  ['main/startup/main-process-ready-runtime.ts', 'configureBrowserClientPageAutomationRuntime'],
  ['main/browser/browser-session-partition-policies.ts', 'installBrowserWebAuthnAccessHandlers'],
  [
    'renderer/src/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx',
    'ClientHostedBrowserPagePane'
  ],
  [
    'renderer/src/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx',
    'RemoteBrowserPagePane'
  ],
  [
    'renderer/src/components/settings/browser/profiles/BrowserProfileRow.tsx',
    'importCookiesFromBrowser'
  ],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerGitHubHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerGitLabHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerHostedReviewHandlers'],
  ['main/ipc/register-core-handlers/register-core-handlers.ts', 'registerBitbucketHandlers'],
  ['main/ipc/source-control/github-pr-read-handlers.ts', 'gh:repoSlug'],
  ['renderer/src/app-shell/ActiveWorkspaceSyncGate.tsx', 'useGitStatusPolling'],
  ['main/runtime/rpc/methods/index.ts', 'LINEAR_METHODS'],
  ['main/runtime/rpc/methods/index.ts', 'LINEAR_AGENT_ACCESS_METHODS'],
  ['main/runtime/rpc/methods/index.ts', 'JIRA_METHODS'],
  ['main/index.ts', 'enableLinearRegexpFallback'],
  [
    'renderer/src/components/sidebar/workspace-reference-detail-read.ts',
    'getWorkspaceReferenceLookup'
  ],
  ['renderer/src/components/sidebar/workspace-hover-attachments.ts', 'gateWorktreeCardAttachments'],
  ['renderer/src/components/sidebar/WorktreeCardMeta.tsx', 'gateWorktreeCardAttachments']
]
/** Platform-gated wiring: [file, guard text, identifier the guard precedes within 200 chars]. */
const GUARDED: readonly (readonly [string, string, string])[] = [
  ['renderer/src/components/editor/IpynbViewer.tsx', 'NOTEBOOK_KERNELS_ENABLED &&', 'notebook'],
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

/** Gated hosted entry points: [file, anchor, guard that must follow the anchor within 240 chars]. */
const GUARD_AFTER: readonly (readonly [string, string, string])[] = [
  [
    'main/ipc/source-control/hosted-review.ts',
    "'hostedReview:forBranch'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/hosted-review.ts',
    "'hostedReview:getCreationEligibility'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-pr-refresh-handlers.ts',
    "'gh:prForBranch'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-pr-refresh-handlers.ts',
    "'gh:refreshPRNow'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-pr-refresh-handlers.ts',
    "'gh:enqueuePRRefresh'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-pr-refresh-handlers.ts',
    "'gh:reportVisiblePRRefreshCandidates'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-work-item-handlers.ts',
    "'gh:issue'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-account-handlers.ts',
    "'gh:checkOrcaStarred'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-account-handlers.ts',
    "'gh:starOrca'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-account-handlers.ts',
    "'gh:listBindableAccounts'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/ipc/source-control/github-pr-read-handlers.ts',
    "'gh:repoUpstream'",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/preflight/agent-detection.ts',
    "detectCommandRuntime('git', context)",
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'shared/task-providers.ts',
    'function isTaskProviderAvailable(',
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'renderer/src/components/landing-preflight-issues.ts',
    'if (!options.hasGitHubBackedProject',
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'renderer/src/components/sidebar/workspace-reference-detail-read.ts',
    'export function getWorkspaceReferenceLookup(',
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'renderer/src/components/sidebar/SidebarGroupByToggle.tsx',
    'GROUP_BY_OPTIONS.filter',
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/git/command-runner/gh-exec-file.ts',
    'export async function ghExecFileWithScopeAsync(',
    'assertHostedCliSpawnAllowed'
  ],
  [
    'main/git/command-runner/glab-exec-file.ts',
    'export async function glabExecFileAsync(',
    'assertHostedCliSpawnAllowed'
  ],
  [
    'main/runtime/runtime-hosted-review-commands.ts',
    '}): Promise<HostedReviewForBranchReply> {',
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ],
  [
    'main/runtime/runtime-hosted-review-commands.ts',
    '): Promise<HostedReviewCreationEligibility> {',
    'HOSTED_SOURCE_CONTROL_ENABLED'
  ]
]

const REPO = join(SRC, '..')
const isDeleted = pureDeletedPathMatcher(PURE_DELETED_PATHS)
const SOURCES = (readdirSync(SRC, { recursive: true }) as string[])
  .map((f) => `src/${f.split('\\').join('/')}`)
  .filter((f) => /\.(ts|tsx|mts|cts|js|mjs)$/.test(f) && !f.includes('/node_modules/'))
const SPEC =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*|vi\.(?:do)?[mM]ock\s*\(\s*|importActual\s*(?:<[^>]*>)?\s*\(\s*)['"]([^'"]+)['"]/g
const targets = (from: string, spec: string): string[] => {
  const base = spec.startsWith('@/')
    ? `src/renderer/src/${spec.slice(2)}`
    : spec.startsWith('.')
      ? join(dirname(from), spec).split('\\').join('/')
      : null
  if (base === null) {
    return []
  }
  const candidates = ['.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e)
  const existing = candidates.filter((c) => existsSync(join(REPO, c)))
  return existing.length > 0 ? existing : [base, ...candidates]
}

describe('zyx/orca-pure wiring', () => {
  it('no file under src/ matches PURE_DELETED_PATHS', () =>
    expect(SOURCES.filter(isDeleted)).toEqual([]))
  it('no kept file imports or mocks a deleted path', () => {
    const offenders = SOURCES.flatMap((f) =>
      [...readFileSync(join(REPO, f), 'utf8').matchAll(SPEC)]
        .filter((m) => targets(f, m[1]).some(isDeleted))
        .map((m) => `${f} -> ${m[1]}`)
    )
    expect(offenders).toEqual([])
  })
  for (const [file, symbol] of REMOVED) {
    it(`${file} no longer wires ${symbol}`, () => expect(read(file)).not.toMatch(token(symbol)))
  }
  for (const [file, symbol] of KEPT) {
    it(`${file} still wires ${symbol}`, () => expect(read(file)).toMatch(token(symbol)))
  }
  for (const [file, anchor, guard] of GUARD_AFTER) {
    it(`${file} gates ${anchor} with ${guard}`, () =>
      expect(read(file)).toMatch(new RegExp(`${esc(anchor)}[\\s\\S]{0,240}${token(guard).source}`)))
  }
  for (const [file, guard, symbol] of GUARDED) {
    it(`${file} gates ${symbol} behind ${guard}`, () =>
      expect(read(file)).toMatch(new RegExp(`${esc(guard)}[\\s\\S]{0,200}${token(symbol).source}`)))
  }
})
