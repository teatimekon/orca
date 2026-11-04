// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import type { Repo } from '../../../../shared/repo-types'
import type { GitLabWorkItem } from '../../../../shared/gitlab-types'
import type { NormalizedWorkItemSourceSearchProps } from './smart-workspace-name-field-model'
import { useWorkItemSourceSearch } from './use-work-item-source-search'
import { useWorkItemSourceFoundation } from './use-work-item-source-foundation'
import { useSmartWorkspaceGitlabSearch } from './use-smart-workspace-gitlab-search'
import { useWorkItemSourcePresentation } from './use-work-item-source-presentation'

const mocks = vi.hoisted(() => ({
  listGitlabWorkItems: vi.fn(),
  state: {
    addRepo: vi.fn(),
    settings: null,
    preflightStatus: null,
    preflightStatusChecked: true,
    preflightStatusContextKey: 'test',
    refreshPreflightStatus: vi.fn()
  }
}))
vi.mock('@/lib/gitlab-work-item-source-lookup', () => ({
  listGitLabWorkItemsForSource: mocks.listGitlabWorkItems,
  lookupGitLabWorkItemByPathForSource: vi.fn()
}))
vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({ ...mocks.state }),
    { getState: () => mocks.state, subscribe: () => () => {} }
  )
}))
vi.mock('@/lib/local-preflight-context', () => ({
  getLocalPreflightContext: () => ({}),
  localPreflightContextKey: () => 'test'
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

function props(): NormalizedWorkItemSourceSearchProps {
  return {
    repos: [],
    repoId: '',
    value: '',
    disabled: false,
    textOnly: false,
    branchesEnabled: false,
    repoBackedSourcesDisabled: true,
    repoBackedSearchRepos: [],
    crossRepoSwitchTarget: 'task-source'
  }
}

describe('smart workspace explicit source connection', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows GitLab workspace search rows without fetching an advertised probe page', async () => {
    const repo: Repo = {
      id: 'server-repo',
      path: '/srv/app',
      displayName: 'app',
      badgeColor: '',
      addedAt: 0,
      executionHostId: 'runtime:remote'
    }
    const items: GitLabWorkItem[] = Array.from({ length: 12 }, (_, index) => ({
      id: `mr-${index + 1}`,
      type: 'mr',
      number: index + 1,
      title: `Merge request ${index + 1}`,
      state: 'opened',
      url: `https://gitlab.com/group/app/-/merge_requests/${index + 1}`,
      labels: [],
      updatedAt: '2026-10-01T00:00:00Z',
      author: null,
      repoId: repo.id
    }))
    mocks.listGitlabWorkItems.mockResolvedValue({
      items,
      page: 1,
      perPage: 12,
      totalCount: 0,
      totalPages: 2
    })
    const fieldProps = {
      ...props(),
      repos: [repo],
      repoId: repo.id,
      repoBackedSourcesDisabled: false,
      value: 'launch'
    }
    const { result } = renderHook(() => {
      const foundation = useWorkItemSourceFoundation(fieldProps)
      useSmartWorkspaceGitlabSearch({
        foundation,
        sourceQueryWithinLimit: true,
        shouldQueryGitlab: true
      })
      return useWorkItemSourcePresentation(foundation)
    })

    await waitFor(() => expect(result.current.searchResultRows).toHaveLength(items.length))
    expect(result.current.searchResultRows).toEqual(
      items.map((item) => ({
        kind: 'gitlab',
        value: `gitlab-${repo.id}-mr-${item.number}`,
        item
      }))
    )
    expect(result.current.loading).toBe(false)
    expect(mocks.listGitlabWorkItems).toHaveBeenCalledTimes(1)
    expect(mocks.listGitlabWorkItems).toHaveBeenCalledWith(
      expect.objectContaining({
        repoPath: repo.path,
        repoId: repo.id,
        state: 'opened',
        page: 1,
        perPage: 12,
        query: 'launch'
      })
    )
  })

  it.each(['https://linear.app/acme/issue/ENG-1/title', 'https://acme.atlassian.net/browse/ENG-1'])(
    'offers no Linear or Jira source for pasted tracker URLs: %s',
    (value) => {
      const serverRepo: Repo = {
        id: 'server-repo',
        path: '/srv/app',
        displayName: 'app',
        badgeColor: '',
        addedAt: 0,
        executionHostId: 'runtime:remote'
      }
      const searchProps = { ...props(), repos: [serverRepo], repoId: serverRepo.id, value }
      const { result } = renderHook(() => useWorkItemSourceSearch(searchProps))
      expect(Object.keys(result.current).filter((key) => /linear|jira/i.test(key))).toEqual([])
    }
  )
})
