import { useAppStore } from '../store'
import { useEditorExternalWatch } from '../hooks/useEditorExternalWatch'
import { useGitStatusPolling } from '../components/right-sidebar/useGitStatusPolling'
import { useWebSessionTabsSync } from '../runtime/web-session-tabs-sync/use-web-session-tabs-sync'

/** Hosts services that track the active workspace, so a switch re-renders this null node instead of App. */
export function ActiveWorkspaceSyncGate(): null {
  const workspaceSessionReady = useAppStore((s) => s.workspaceSessionReady)
  useWebSessionTabsSync()
  // Poll above the removable sidebar to keep rebase/merge badges fresh; wait for session readiness to protect first paint.
  useGitStatusPolling({ enabled: workspaceSessionReady })
  // Watch files above Explorer so editor changes still arrive on Source Control/Checks.
  useEditorExternalWatch()
  return null
}
