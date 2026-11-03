import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import {
  getFloatingWorkspaceOperationRoute,
  resolveWorktreeOperationRoute,
  type WorktreeOperationRouteState
} from '@/lib/worktree-operation-route'
import { parseExecutionHostId } from '../../../../shared/execution-host'

/** pi-web serves this computer's directories, so only this desktop's own local workspaces can use it. */
export function isPiWebLocalWorkspace(
  state: WorktreeOperationRouteState,
  worktreeId: string
): boolean {
  if (isPairedWebClientWindow()) {
    return false
  }
  // Same owner resolution the managed browser uses; SSH, runtime-owned and unresolved workspaces fail closed.
  const route =
    getFloatingWorkspaceOperationRoute(worktreeId) ??
    resolveWorktreeOperationRoute(state, worktreeId)
  return (
    !route?.runtimeEnvironmentId && parseExecutionHostId(route?.executionHostId)?.kind === 'local'
  )
}
