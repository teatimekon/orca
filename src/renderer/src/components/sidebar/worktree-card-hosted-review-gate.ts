import { HOSTED_SOURCE_CONTROL_ENABLED } from '../../../../shared/pure-hosted-source-control'
import type { useWorktreeCardLinkedDetails } from './use-worktree-card-linked-details'
import type { useWorktreeCardReviewDetails } from './use-worktree-card-review-details'

/** zyx/orca-pure: hide every hosted PR/MR/issue decoration (identity when the gate is on). */
export function gateWorktreeCardReviewDetails<
  T extends ReturnType<typeof useWorktreeCardReviewDetails>
>(review: T): T {
  if (HOSTED_SOURCE_CONTROL_ENABLED) {
    return review
  }
  return {
    ...review,
    prDisplay: null,
    issueEntry: undefined,
    // Empty cache keys make the card's fetch effects return early.
    hostedReviewCacheKey: '',
    issueCacheKey: '',
    linkedGitHubPR: null,
    linkedGitLabMR: null,
    linkedBitbucketPR: null,
    linkedAzureDevOpsPR: null,
    linkedGiteaPR: null,
    cachedBranchFallbackGitHubPRNumber: null
  }
}

export function gateWorktreeCardLinkedDetails<
  T extends ReturnType<typeof useWorktreeCardLinkedDetails>
>(linked: T): T {
  if (HOSTED_SOURCE_CONTROL_ENABLED) {
    return linked
  }
  return { ...linked, issueDisplay: null }
}

/** Hosted PR/MR/issue attachments render nothing while the gate is off; Linear and Jira stay. */
export function gateWorktreeCardAttachments<T extends { provider?: string }>(items: T[]): T[] {
  return HOSTED_SOURCE_CONTROL_ENABLED
    ? items
    : items.filter((item) => item.provider === 'linear' || item.provider === 'jira')
}
