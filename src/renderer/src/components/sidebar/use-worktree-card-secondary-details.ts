import { useCallback } from 'react'
import type { WorkspaceAttachment } from '../../../../shared/worktree/types'
import { getWorkspaceAttachmentKey } from '../../../../shared/workspace-attachment-normalization'
import { buildWorkspaceAttachmentEdits } from './worktree-attachment-editing'
import { getWorkspaceAttachments } from '../../../../shared/workspace-attachments'
import { gateWorktreeCardAttachments } from './worktree-card-hosted-review-gate'
import { toast } from 'sonner'

import { translate } from '@/i18n/i18n'
import { openWorkspaceBrowserTab } from '@/lib/workspace-browser-tab-open'
import { hasWorktreeCardDetails } from './WorktreeCardMeta'
import { usePromptCacheCountdownStartedAt } from './CacheTimer'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import type { WorktreeCardProps } from './worktree-card-model'
import type { useWorktreeCardFoundation } from './use-worktree-card-foundation'
import type { useWorktreeCardLinkedDetails } from './use-worktree-card-linked-details'
import type { useWorktreeCardReviewDetails } from './use-worktree-card-review-details'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>
type LinkedDetails = ReturnType<typeof useWorktreeCardLinkedDetails>
type ReviewDetails = ReturnType<typeof useWorktreeCardReviewDetails>

export function useWorktreeCardSecondaryDetails({
  worktree,
  statusPrDisplay,
  showStatus,
  showIssue,
  showLinearIssue,
  showJiraIssue,
  showPR,
  showCli,
  showComment,
  showPorts,
  issueDisplay,
  linearIssueDisplay,
  jiraIssueDisplay,
  prDisplay,
  linkedGitLabMR,
  linkedBitbucketPR,
  linkedAzureDevOpsPR,
  linkedGiteaPR,
  newCardStyle,
  compactCards,
  cardDetails,
  agentActivityDisplayMode,
  workspacePorts,
  updateWorktreeMeta,
  settings
}: Pick<WorktreeCardProps, 'worktree' | 'repo' | 'statusPrDisplay'> &
  Pick<
    Foundation,
    | 'newCardStyle'
    | 'compactCards'
    | 'cardDetails'
    | 'agentActivityDisplayMode'
    | 'workspacePorts'
    | 'updateWorktreeMeta'
    | 'settings'
  > &
  Pick<LinkedDetails, 'issueDisplay' | 'linearIssueDisplay' | 'jiraIssueDisplay'> &
  Pick<
    ReviewDetails,
    'prDisplay' | 'linkedGitLabMR' | 'linkedBitbucketPR' | 'linkedAzureDevOpsPR' | 'linkedGiteaPR'
  > & {
    showStatus: boolean
    showIssue: boolean
    showLinearIssue: boolean
    showJiraIssue: boolean
    showPR: boolean
    showCli: boolean
    showComment: boolean
    showPorts: boolean
  }) {
  // Why: unread lives in the left status lane, so the Status toggle owns both the dot/PR slot and unread emphasis.
  const showUnreadEmphasis = showStatus && worktree.isUnread
  const hoverIssue = issueDisplay
  const hoverLinearIssue = linearIssueDisplay
  const hoverJiraIssue = jiraIssueDisplay
  const hoverReview = prDisplay
  const statusLaneReview = statusPrDisplay ?? hoverReview
  const hoverComment = worktree.comment
  const metaIssue = showIssue ? hoverIssue : null
  const metaLinearIssue = showLinearIssue ? hoverLinearIssue : null
  const metaJiraIssue = showJiraIssue ? hoverJiraIssue : null
  const metaReview = showPR ? hoverReview : null
  const metaCliProvenance = showCli ? worktree.cliProvenance : null
  const metaComment = showComment ? hoverComment : null
  const showInlineAgentList = cardDetails.inlineAgents
  const compactInlineAgentRows = useWorktreeAgentRows(
    worktree.id,
    showInlineAgentList && agentActivityDisplayMode === 'compact'
  )
  const compactInlineAgentRowsVisible =
    showInlineAgentList &&
    agentActivityDisplayMode === 'compact' &&
    compactInlineAgentRows.length > 0
  const showAggregateCacheTimer = !compactCards && !compactInlineAgentRowsVisible
  const openLinkedUrlInBrowser = useCallback(
    (url: string): void => {
      void openWorkspaceBrowserTab({
        workspaceId: worktree.id,
        url,
        intent: { kind: 'url' }
      }).catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : translate('auto.lib.workspace.browser.tab.open.urlFailed', 'Unable to open URL.')
        )
      })
    },
    [worktree.id]
  )
  const handleOpenIssueInBrowser = useCallback(
    (url: string): void => {
      openLinkedUrlInBrowser(url)
    },
    [openLinkedUrlInBrowser]
  )
  const handleOpenReviewInBrowser = useCallback(
    (url: string): void => {
      openLinkedUrlInBrowser(url)
    },
    [openLinkedUrlInBrowser]
  )
  const hoverReviewProvider = hoverReview?.provider
  const canUnlinkReview =
    hoverReviewProvider === 'github' ||
    (hoverReviewProvider === 'gitlab' && linkedGitLabMR !== null) ||
    (hoverReviewProvider === 'bitbucket' && linkedBitbucketPR !== null) ||
    (hoverReviewProvider === 'azure-devops' && linkedAzureDevOpsPR !== null) ||
    (hoverReviewProvider === 'gitea' && linkedGiteaPR !== null)
  const hasExplicitLinkedReview =
    (hoverReviewProvider === 'github' && worktree.linkedPR !== null) ||
    (hoverReviewProvider === 'gitlab' && linkedGitLabMR !== null) ||
    (hoverReviewProvider === 'bitbucket' && linkedBitbucketPR !== null) ||
    (hoverReviewProvider === 'azure-devops' && linkedAzureDevOpsPR !== null) ||
    (hoverReviewProvider === 'gitea' && linkedGiteaPR !== null)
  const handleUnlinkReview = useCallback(
    async (item?: WorkspaceAttachment) => {
      const options = { executionHostId: worktree.hostId ?? 'local' }
      if (item) {
        const initial = getWorkspaceAttachments(worktree)
        const key = getWorkspaceAttachmentKey(item)
        const draft = initial.filter((entry) => getWorkspaceAttachmentKey(entry) !== key)
        const result = await updateWorktreeMeta(
          worktree.id,
          {
            ...buildWorkspaceAttachmentEdits({ initial, draft }),
            ...(item.provider === 'github' &&
            hoverReview?.provider === 'github' &&
            hoverReview.number === item.number &&
            (!item.url || item.url === hoverReview.url)
              ? { suppressedGitHubPR: item.number }
              : {})
          },
          options
        )
        if (!result.ok) {
          toast.error(result.error)
        }
        return
      }
      switch (hoverReviewProvider) {
        case 'github':
          if (hoverReview) {
            const result = await updateWorktreeMeta(
              worktree.id,
              { linkedPR: null, suppressedGitHubPR: hoverReview.number },
              options
            )
            if (!result.ok) {
              toast.error(result.error)
            }
          }
          return
        case 'gitlab':
          void updateWorktreeMeta(worktree.id, { linkedGitLabMR: null }, options)
          return
        case 'bitbucket':
          void updateWorktreeMeta(worktree.id, { linkedBitbucketPR: null }, options)
          return
        case 'azure-devops':
          void updateWorktreeMeta(worktree.id, { linkedAzureDevOpsPR: null }, options)
          return
        case 'gitea':
          void updateWorktreeMeta(worktree.id, { linkedGiteaPR: null }, options)
          break
        case 'unsupported':
        case undefined:
          break
      }
    },
    [hoverReview, hoverReviewProvider, updateWorktreeMeta, worktree]
  )
  const hasDetails =
    gateWorktreeCardAttachments(getWorkspaceAttachments(worktree)).length > 0 ||
    hasWorktreeCardDetails({
      issue: metaIssue,
      linearIssue: metaLinearIssue,
      jiraIssue: metaJiraIssue,
      review: newCardStyle ? null : metaReview,
      comment: metaComment,
      cliProvenance: metaCliProvenance
    })
  const hasPorts = showPorts && workspacePorts.length > 0
  const cacheStartedAt = usePromptCacheCountdownStartedAt(worktree.id, showAggregateCacheTimer)
  // Reuse subscribed card settings to avoid another per-card listener on every store write.
  const cacheTtlMs = showAggregateCacheTimer ? (settings?.promptCacheTtlMs ?? 0) : 0

  return {
    showUnreadEmphasis,
    hoverIssue,
    hoverLinearIssue,
    hoverJiraIssue,
    hoverReview,
    statusLaneReview,
    hoverComment,
    metaIssue,
    metaLinearIssue,
    metaJiraIssue,
    metaReview,
    metaCliProvenance,
    metaComment,
    showInlineAgentList,
    compactInlineAgentRows,
    handleOpenIssueInBrowser,
    canUnlinkReview,
    handleOpenReviewInBrowser,
    hasExplicitLinkedReview,
    handleUnlinkReview,
    hasDetails,
    hasPorts,
    cacheStartedAt,
    cacheTtlMs
  }
}
