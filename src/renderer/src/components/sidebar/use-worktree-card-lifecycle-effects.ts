import { useEffect } from 'react'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'

import { isMacAppDataPath } from '@/lib/passive-macos-app-data-access'
import { isWindowVisible } from '@/lib/window-visibility-interval'
import { isWebClient, type WorktreeCardProps } from './worktree-card-model'
import type { useWorktreeCardFoundation } from './use-worktree-card-foundation'
import type { useWorktreeCardReviewDetails } from './use-worktree-card-review-details'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>
type ReviewDetails = ReturnType<typeof useWorktreeCardReviewDetails>

export function useWorktreeCardLifecycleEffects({
  worktree,
  repo,
  isFolder,
  hostedReviewCacheKey,
  cachedBranchFallbackGitHubPRNumber,
  linkedGitLabMR,
  linkedBitbucketPR,
  linkedAzureDevOpsPR,
  linkedGiteaPR,
  branch,
  fetchHostedReviewForBranch,
  shouldRefreshHostedReview,
  newCardStyle,
  hoverDetailsOpen
}: Pick<WorktreeCardProps, 'worktree' | 'repo'> &
  Pick<
    ReviewDetails,
    | 'isFolder'
    | 'hostedReviewCacheKey'
    | 'cachedBranchFallbackGitHubPRNumber'
    | 'linkedGitLabMR'
    | 'linkedBitbucketPR'
    | 'linkedAzureDevOpsPR'
    | 'linkedGiteaPR'
    | 'branch'
  > &
  Pick<Foundation, 'fetchHostedReviewForBranch' | 'newCardStyle'> & {
    shouldRefreshHostedReview: boolean
    hoverDetailsOpen: boolean
  }): void {
  const hostedReviewExactKey = !branch || branch === 'HEAD' ? hostedReviewCacheKey : undefined
  useEffect(() => {
    if (
      !newCardStyle ||
      !hoverDetailsOpen ||
      !isWindowVisible() ||
      shouldRefreshHostedReview ||
      isWebClient() ||
      !repo ||
      isFolder ||
      worktree.isBare ||
      !hostedReviewCacheKey ||
      isMacAppDataPath(repo.path)
    ) {
      return
    }
    // Why: hidden card metadata is revealed on whole-card hover, so fetch lazily instead of always-on polling.
    void fetchHostedReviewForBranch(repo.path, branch, {
      repoId: repo.id,
      repoOwnerExecutionHostId: getRepoExecutionHostId(repo),
      ...(hostedReviewExactKey ? { exactReviewKey: hostedReviewExactKey } : {}),
      linkedGitHubPR: worktree.linkedPR ?? null,
      ...(cachedBranchFallbackGitHubPRNumber !== null
        ? { fallbackGitHubPR: cachedBranchFallbackGitHubPRNumber }
        : {}),
      currentHeadOid: hostedReviewExactKey ? null : (worktree.head ?? null),
      linkedGitLabMR,
      linkedBitbucketPR,
      linkedAzureDevOpsPR,
      linkedGiteaPR,
      staleWhileRevalidate: true
    })
  }, [
    hoverDetailsOpen,
    newCardStyle,
    shouldRefreshHostedReview,
    repo,
    isFolder,
    worktree.isBare,
    worktree.linkedPR,
    worktree.head,
    cachedBranchFallbackGitHubPRNumber,
    linkedGitLabMR,
    linkedBitbucketPR,
    linkedAzureDevOpsPR,
    linkedGiteaPR,
    fetchHostedReviewForBranch,
    branch,
    hostedReviewCacheKey,
    hostedReviewExactKey
  ])
}
