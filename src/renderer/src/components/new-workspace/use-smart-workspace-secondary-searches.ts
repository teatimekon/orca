import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { useEffect, useMemo } from 'react'
import { searchRuntimeRepoBaseRefDetails } from '@/runtime/runtime-repo-client'
import { RESULT_LIMIT } from './smart-workspace-name-field-model'
import { getBranchSearchRequest } from '../../../../shared/new-workspace/smart-workspace-source-results'
import type { useWorkItemSourceFoundation } from './use-work-item-source-foundation'

export function useSmartWorkspaceSecondarySearches({
  foundation
}: {
  foundation: ReturnType<typeof useWorkItemSourceFoundation>
}): void {
  const {
    disabled,
    branchesEnabled,
    repoBackedSourcesDisabled,
    textOnly,
    mode,
    selectedRepo,
    debouncedQuery,
    setBranches,
    setBranchResultsSource,
    setBranchesLoading
  } = foundation
  const branchSearchRequest = useMemo(
    () =>
      getBranchSearchRequest({
        disabled,
        branchesEnabled: branchesEnabled && !repoBackedSourcesDisabled,
        textOnly,
        mode,
        selectedRepoId: selectedRepo?.id ?? null,
        query: debouncedQuery,
        limit: RESULT_LIMIT
      }),
    [
      branchesEnabled,
      debouncedQuery,
      disabled,
      mode,
      repoBackedSourcesDisabled,
      selectedRepo?.id,
      textOnly
    ]
  )

  const selectedRepoHostId = selectedRepo ? getRepoExecutionHostId(selectedRepo) : null
  useEffect(() => {
    if (!branchSearchRequest || !selectedRepoHostId) {
      setBranches([])
      setBranchResultsSource(null)
      setBranchesLoading(false)
      return
    }
    let stale = false
    const { repoId, query, limit } = branchSearchRequest
    setBranchesLoading(true)
    void searchRuntimeRepoBaseRefDetails(selectedRepoHostId, repoId, query, limit)
      .then((results) => {
        if (!stale) {
          setBranches(results)
          setBranchResultsSource({ repoId, query })
        }
      })
      .catch(() => {
        if (!stale) {
          setBranches([])
          setBranchResultsSource(null)
        }
      })
      .finally(() => {
        if (!stale) {
          setBranchesLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [
    branchSearchRequest,
    selectedRepoHostId,
    setBranches,
    setBranchResultsSource,
    setBranchesLoading
  ])
}
