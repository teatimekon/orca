/** Route main's pi-web completion and needs-input events through the shared attention policy and delivery. */
import {
  deliverAgentAttentionNotification,
  readAgentAttentionNotificationSound
} from '@/attention/agent-attention-notification-delivery'
import { applyAgentAttention, resolveAgentAttention } from '@/attention/agent-attention-policy'
import { getNotificationWorkspaceLabels } from '@/components/terminal-pane/terminal-notification-state'
import { useAppStore } from '@/store'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { PiWebAttentionEvent } from '../../../../shared/pi-web/pi-web-status-types'
import { createPiWebAttentionSurface } from './pi-web-attention-surface'

// Main's reducer already dedupes repeats, so each forwarded event is distinct news that must bypass worktree burst dedupe.
let attentionSequence = 0

export function dispatchPiWebAttention(event: PiWebAttentionEvent): void {
  const state = useAppStore.getState()
  const paneKey = piWebPaneKey(event.sessionId)
  const worktreeId = event.worktreeId
  const title = event.name ?? 'pi-web'
  const decision = resolveAgentAttention(
    {
      subject: { workspaceId: worktreeId, surfaceKey: paneKey },
      reason: 'agent-completion',
      // A prompt earns unread like a settled turn, as native chat's does.
      settlesTurn: true,
      // Main raises each event from a live pi-web status frame, never from a snapshot.
      hasFreshActivityEvidence: true
    },
    createPiWebAttentionSurface(state)
  )
  applyAgentAttention(decision, {
    unread: state.markAgentAttentionUnread,
    requestDelivery: (request) => {
      attentionSequence += 1
      deliverAgentAttentionNotification(
        {
          source: 'agent-task-complete',
          surface: 'pi-web',
          piWebSessionId: event.sessionId,
          agentType: 'pi-web',
          agentState: event.kind === 'completed' ? 'done' : 'blocked',
          paneKey,
          worktreeId,
          terminalTitle: title,
          // Why: agentType selects the rich copy, whose body ignores terminalTitle and reads this field.
          ...(event.name ? { agentLastAssistantMessage: event.name } : {}),
          // pi-web already web-pushes its phones; a second fan-out from Orca would duplicate it.
          mobileDeliveredByHost: true,
          attentionKey: `pi-web:${event.sessionId}:${event.kind}:${attentionSequence}`,
          isActiveWorktree: request.workspaceIsActive,
          // pi-web runs beside this desktop, so the "this machine" notification mute covers it.
          notificationSourceId: LOCAL_EXECUTION_HOST_ID,
          ...getNotificationWorkspaceLabels(state, worktreeId, title)
        },
        readAgentAttentionNotificationSound(state.settings ?? {})
      )
    }
  })
}
