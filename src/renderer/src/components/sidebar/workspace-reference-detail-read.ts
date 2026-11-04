import { useAppStore } from '@/store'
import { HOSTED_SOURCE_CONTROL_ENABLED } from '../../../../shared/pure-hosted-source-control'
import type { AppState } from '@/store/types'
import { PrioritySemaphore } from '../../../../shared/priority-semaphore'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { getTaskSourceCacheScope } from '../../../../shared/task-source-context'
import { canReadWorkspaceReferenceReview } from './workspace-reference-review-source'
import { isWorkspaceRepositoryAttachment } from './worktree-attachment-editing'
import {
  matchesWorkspaceReferenceUrl,
  matchWorkspaceReferenceReview,
  type WorkspaceReferenceDetails,
  type WorkspaceReferenceRequest
} from './workspace-reference-details'

type Entry<T> = { data: T | null; fetchedAt: number; stale?: boolean }
const reads = new PrioritySemaphore(3)

function lookup<T>(
  entry: Entry<T> | undefined,
  read: (signal?: AbortSignal) => Promise<T | null>,
  project: (value: T) => WorkspaceReferenceDetails | null
) {
  return {
    rawEntry: entry,
    entry: entry && { ...entry, data: entry.data && project(entry.data) },
    read: async (signal?: AbortSignal) => {
      const value = await read(signal)
      return value && project(value)
    }
  }
}

export function getWorkspaceReferenceLookup(request: WorkspaceReferenceRequest, state: AppState) {
  const { item, workspace, repo, sourceContext } = request
  // zyx/orca-pure: hosted review and GitHub issue references read nothing; Linear/Jira branches stay.
  if (!HOSTED_SOURCE_CONTROL_ENABLED && (item.type !== 'issue' || item.provider === 'github')) {
    return null
  }
  if (item.type !== 'issue') {
    if (!repo || !canReadWorkspaceReferenceReview(request, request.knownProvider)) {
      return null
    }
    return lookup(
      state.hostedReviewCache?.[request.key],
      () =>
        state.fetchHostedReviewForBranch(repo.path, workspace.branch ?? '', {
          exactReviewKey: request.key,
          repoId: repo.id,
          repoOwnerExecutionHostId: getRepoExecutionHostId(repo),
          admissionTier: request.admissionTier ?? 'interactive',
          linkedGitHubPR: item.provider === 'github' ? item.number : null,
          linkedGitLabMR: item.provider === 'gitlab' ? item.number : null,
          linkedBitbucketPR: item.provider === 'bitbucket' ? item.number : null,
          linkedAzureDevOpsPR: item.provider === 'azure-devops' ? item.number : null,
          linkedGiteaPR: item.provider === 'gitea' ? item.number : null
        }),
      (review) =>
        matchWorkspaceReferenceReview(item, review)
          ? { title: review.title, url: review.url, review }
          : null
    )
  }
  if (!sourceContext) {
    return null
  }
  const scope = getTaskSourceCacheScope(sourceContext)
  if (
    item.provider === 'github' &&
    repo &&
    sourceContext.provider === 'github' &&
    isWorkspaceRepositoryAttachment(item, repo)
  ) {
    return lookup(
      state.issueCache?.[`${scope}::${repo.id}::${item.number}`],
      () => state.fetchIssue(repo.path, item.number, { repoId: repo.id, sourceContext }),
      (issue) =>
        issue.number === item.number && matchesWorkspaceReferenceUrl(item, issue.url)
          ? { title: issue.title, url: issue.url, issueState: issue.state }
          : null
    )
  }
  return null
}

export async function readWorkspaceReferenceDetails(
  request: WorkspaceReferenceRequest,
  signal?: AbortSignal
): Promise<WorkspaceReferenceDetails | null> {
  const release = await reads.acquire(request.admissionTier === 'background' ? 1 : 0, signal)
  try {
    if (signal?.aborted) {
      return null
    }
    return (
      (await getWorkspaceReferenceLookup(request, useAppStore.getState())?.read(signal)) ?? null
    )
  } finally {
    // Native reads retain admission until settlement, even after demand disappears.
    release()
  }
}
