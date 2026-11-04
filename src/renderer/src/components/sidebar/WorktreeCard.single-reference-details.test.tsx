// @vitest-environment happy-dom
import type { ReactNode } from 'react'
import { renderHook, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorktreeCardReviewDetails } from './use-worktree-card-review-details'
import { referenceWorkspace, referenceRepo } from './workspace-reference-fixtures.test-support'
import { getWorkspaceReferenceRequest } from './workspace-reference-details'

const cache = vi.hoisted(() => ({ entries: {}, hosted: {} }))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      hostedReviewCache: cache.hosted,
      prCache: {},
      issueCache: {}
    })
}))
vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null
}))
vi.mock('@/components/SelectedTextCopyMenu', () => ({
  SelectedTextCopyMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))
vi.mock('./workspace-delete-quick-action', () => ({
  useWorkspaceDeleteModifierPressed: () => false
}))
afterEach(cleanup)

describe('single linked reference rich hover details', () => {
  it.each([
    {
      data: {
        provider: 'gitlab' as const,
        number: 8,
        title: 'Fix detached review',
        state: 'open' as const,
        status: 'success' as const,
        updatedAt: '',
        mergeable: 'MERGEABLE' as const,
        url: 'https://gitlab.example.com/team/repo/-/merge_requests/8'
      },
      title: 'Fix detached review'
    },
    { data: null, title: 'MR details unavailable' }
  ])(
    'reads detached MR details from the same exact cache as Linked work: $title',
    ({ data, title }) => {
      const repo = {
        ...referenceRepo,
        gitRemoteIdentity: {
          canonicalKey: 'gitlab.example.com/team/repo',
          remoteName: 'origin',
          remoteUrl: 'https://gitlab.example.com/team/repo.git'
        }
      }
      const item = {
        provider: 'gitlab' as const,
        type: 'mr' as const,
        number: 8,
        url: 'https://gitlab.example.com/team/repo/-/merge_requests/8'
      }
      const workspace = {
        ...referenceWorkspace,
        branch: '',
        linkedPR: null,
        linkedGitLabMR: 8,
        linkedItems: [item]
      }
      const key = getWorkspaceReferenceRequest(item, workspace, repo).key
      cache.hosted = { [key]: { data, fetchedAt: Date.now(), linkedReviewHintKey: 'gitlab:8' } }
      const { result } = renderHook(() =>
        useWorktreeCardReviewDetails({
          worktree: workspace,
          repo,
          settings: null,
          projectGroups: [],
          cardProps: ['pr'],
          newCardStyle: false
        })
      )
      expect(result.current.hostedReviewCacheKey).toBe(key)
      expect(result.current.prDisplay?.title).toBe(title)
    }
  )
})
