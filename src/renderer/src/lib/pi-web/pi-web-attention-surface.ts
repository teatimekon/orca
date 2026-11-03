/** pi-web subjects are registry rows with no Orca tab behind them; the pane key's tab id is a shared placeholder. */
import type { AgentAttentionSurface } from '@/attention/agent-attention-contract'
import { isWorkspaceNotificationMutedBySidebarFilters } from '@/attention/hidden-workspace-notification-mute'
import { isWorkspaceOnScreen } from '@/hooks/agent-auto-ack-targets'
import type { AppState } from '@/store/types'
import { PI_WEB_PANE_TAB_ID } from '../../../../shared/pi-web/pi-web-pane-key'
import { lookupPiWebRow } from './pi-web-row-registry'

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
    // Why: Orca cannot tell which conversation an embedded pi-web page shows, so the workspace on screen stands in.
    isSurfaceViewed: (subject) => isWorkspaceOnScreen(state, subject.workspaceId),
    isWorkspaceViewed: (workspaceId) => isWorkspaceOnScreen(state, workspaceId),
    isWorkspaceActive: (workspaceId) => state.activeWorktreeId === workspaceId,
    isWorkspaceMuted: (workspaceId) =>
      isWorkspaceNotificationMutedBySidebarFilters(state, workspaceId),
    // No auto-ack target ever resolves to the placeholder tab.
    resolveViewedSubjectKey: () => null
  }
}
