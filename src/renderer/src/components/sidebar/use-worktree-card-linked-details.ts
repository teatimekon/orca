import { translate } from '@/i18n/i18n'
import type { IssueInfo } from '../../../../shared/github/pull-request-types'
import type { LinearIssue } from '../../../../shared/linear/issue-types'
import type {
  WorktreeCardIssueDisplay,
  WorktreeCardJiraIssueDisplay,
  WorktreeCardLinearIssueDisplay
} from './WorktreeCardMeta'
import {
  coerceWorktreeCardVisibleTitle,
  getWorktreeCardTitleDisplay
} from './worktree-card-title-display'
import { useWorkspaceDeleteModifierPressed } from './workspace-delete-quick-action'
import type { WorktreeCardProps } from './worktree-card-model'
import type { useWorktreeCardFoundation } from './use-worktree-card-foundation'
import type { useWorktreeCardReviewDetails } from './use-worktree-card-review-details'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>
type ReviewDetails = ReturnType<typeof useWorktreeCardReviewDetails>

export function useWorktreeCardLinkedDetails({
  worktree,
  newCardStyle,
  deleteState,
  branch,
  issueEntry,
  prDisplay
}: Pick<WorktreeCardProps, 'worktree'> &
  Pick<Foundation, 'newCardStyle' | 'deleteState'> &
  Pick<ReviewDetails, 'branch' | 'issueEntry' | 'prDisplay'>) {
  const issue: IssueInfo | null | undefined = worktree.linkedIssue
    ? issueEntry !== undefined
      ? issueEntry.data
      : undefined
    : null
  const issueDisplay: WorktreeCardIssueDisplay | null =
    issue ??
    (worktree.linkedIssue
      ? {
          number: worktree.linkedIssue,
          // Why: linked metadata persists immediately but GitHub details arrive async; show the link number so it doesn't look unlinked.
          title:
            issue === null
              ? translate(
                  'auto.components.sidebar.useWorktreeCardLinkedDetails.issueUnavailable',
                  'Issue details unavailable'
                )
              : translate(
                  'auto.components.sidebar.useWorktreeCardLinkedDetails.loadingIssue',
                  'Loading issue...'
                )
        }
      : null)
  // zyx/orca-pure: Linear and Jira are removed, so no tracker issue is ever resolved for a card.
  const linearIssue: LinearIssue | null = null
  const linearIssueDisplay: WorktreeCardLinearIssueDisplay | null = null
  const jiraIssueDisplay: WorktreeCardJiraIssueDisplay | null = null
  const cardTitleDisplay = getWorktreeCardTitleDisplay({
    storedDisplayName: worktree.displayName,
    branchName: branch,
    // Fetched titles only: display fallbacks hold localized loading/unavailable placeholders.
    issueTitle: issue?.title,
    reviewTitle: prDisplay?.title
  })
  const legacyCardTitleDisplay = coerceWorktreeCardVisibleTitle(worktree.displayName)
  const visibleCardTitle = newCardStyle ? cardTitleDisplay : legacyCardTitleDisplay
  const isDeleting = deleteState?.isDeleting ?? false
  const isQueuedForDeletion = deleteState?.phase === 'queued'
  const deleteLabel = isQueuedForDeletion
    ? translate('auto.components.sidebar.WorktreeCard.ef18787206', 'Queued for deletion')
    : translate('auto.components.sidebar.WorktreeCard.691ccfd622', 'Deleting…')
  const deleteModifierPressed = useWorkspaceDeleteModifierPressed()

  return {
    issueDisplay,
    linearIssue,
    linearIssueDisplay,
    jiraIssueDisplay,
    visibleCardTitle,
    isDeleting,
    isQueuedForDeletion,
    deleteLabel,
    deleteModifierPressed
  }
}
