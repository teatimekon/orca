/** pi-web subjects are registry rows with no Orca tab behind them; the pane key's tab id is a shared placeholder. */
import type { AgentAttentionSurface } from '@/attention/agent-attention-contract'
import {
  computeAgentAcknowledgementTargets,
  readAgentAttentionTurnStartedAt
} from '@/attention/agent-attention-acknowledgement'
import { isWorkspaceNotificationMutedBySidebarFilters } from '@/attention/hidden-workspace-notification-mute'
import { isWorkspaceOnScreen } from '@/hooks/agent-auto-ack-targets'
import type { AppState } from '@/store/types'
import { PI_WEB_PANE_TAB_ID, piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import { lookupPiWebRow } from './pi-web-row-registry'
import { piWebUrlSessionId } from './pi-web-url'

/** The row whose conversation the on-screen workspace's active pi-web page shows (`?session=`). */
export function resolveViewedPiWebPaneKey(state: AppState): string | null {
  const worktreeId = state.activeWorktreeId
  if (!worktreeId || state.activeTabTypeByWorktree[worktreeId] !== 'browser') {
    return null
  }
  const tabId = state.activeBrowserTabIdByWorktree[worktreeId]
  const tab = state.browserTabsByWorktree[worktreeId]?.find((item) => item.id === tabId)
  const page = tab && state.browserPagesByWorkspace[tab.id]?.find((p) => p.id === tab.activePageId)
  const sessionId = page ? piWebUrlSessionId(page.url) : null
  const paneKey = sessionId ? piWebPaneKey(sessionId) : null
  return paneKey &&
    lookupPiWebRow(paneKey)?.worktreeId === worktreeId &&
    isWorkspaceOnScreen(state, worktreeId)
    ? paneKey
    : null
}

/** Auto-ack for pi-web: the shared scan only reads terminal and chat tabs, never a browser page. */
export function acknowledgeViewedPiWebRow(state: AppState): void {
  const paneKey = resolveViewedPiWebPaneKey(state)
  if (paneKey === null) {
    return
  }
  const records = {
    liveTurns: state.agentStatusByPaneKey,
    retainedTurns: state.retainedAgentsByPaneKey,
    acknowledgedTurnStartedAt: state.acknowledgedAgentsByPaneKey
  }
  // Explicit "mark unread" on this very turn outlasts viewing it, as for terminal rows.
  const toAck = computeAgentAcknowledgementTargets(records, paneKey).filter(
    (key) =>
      state.manuallyUnreadTurnsByPaneKey[key] !== readAgentAttentionTurnStartedAt(records, key)
  )
  if (toAck.length > 0) {
    state.acknowledgeAgents(toAck)
  }
}

export function createPiWebAttentionSurface(state: AppState): AgentAttentionSurface {
  return {
    hasLiveSession: (subject) =>
      subject.surfaceKey !== undefined &&
      lookupPiWebRow(subject.surfaceKey)?.worktreeId === subject.workspaceId,
    admitSurface: (subject) => {
      const row = lookupPiWebRow(subject.surfaceKey)
      if (!row) {
        return { admitted: false, cause: 'unknown-surface' }
      }
      // No tab owns the placeholder id, so tab markers skip it and only pane/workspace markers land.
      return row.worktreeId === subject.workspaceId
        ? { admitted: true, groupId: PI_WEB_PANE_TAB_ID }
        : { admitted: false, cause: 'superseded-surface' }
    },
    // Why the workspace: no tab marker can clear a pi-web unread, so one on the workspace in view would linger.
    isSurfaceViewed: (subject) => isWorkspaceOnScreen(state, subject.workspaceId),
    isWorkspaceViewed: (workspaceId) => isWorkspaceOnScreen(state, workspaceId),
    isWorkspaceActive: (workspaceId) => state.activeWorktreeId === workspaceId,
    isWorkspaceMuted: (workspaceId) =>
      isWorkspaceNotificationMutedBySidebarFilters(state, workspaceId),
    // No auto-ack target ever resolves to the placeholder tab; acknowledgeViewedPiWebRow covers the page.
    resolveViewedSubjectKey: () => null
  }
}
