import { useEffect, useMemo } from 'react'
import { CaseSensitive, LoaderCircle, Search } from 'lucide-react'
import { parseGitHubIssueOrPRLink } from '@/lib/github-links'
import { parseGitLabIssueOrMRLink } from '@/lib/gitlab-links'
import { resolveSmartWorkspaceCommandValue } from './smart-workspace-command-value'
import {
  buildSmartWorkspaceSourceRows,
  getVisibleBranchResults,
  getVisibleHeldProviderResults,
  isBlockingTaskUrlResolution,
  isSmartWorkspaceSourceQueryWithinLimit
} from '../../../../shared/new-workspace/smart-workspace-source-results'
import { RESULT_LIMIT, type RowEntry } from './smart-workspace-name-field-model'
import type { useWorkItemSourceFoundation } from './use-work-item-source-foundation'

type Foundation = ReturnType<typeof useWorkItemSourceFoundation>

function isTypedTextSourceRow(row: RowEntry): boolean {
  return row.kind === 'use-name' || row.kind === 'create-branch'
}

export function useWorkItemSourcePresentation(foundation: Foundation) {
  const {
    branches,
    mode,
    branchResultsSource,
    selectedRepo,
    value,
    githubItems,
    debouncedQuery,
    gitlabSourceAvailable,
    gitlabItems,
    commandValue,
    setCommandValue,
    githubLoading,
    gitlabLoading,
    branchesLoading
  } = foundation
  const githubUrlIntent = useMemo(
    () =>
      isSmartWorkspaceSourceQueryWithinLimit(value) && (mode === 'smart' || mode === 'github')
        ? parseGitHubIssueOrPRLink(value)
        : null,
    [mode, value]
  )
  const gitlabUrlIntent = useMemo(
    () =>
      isSmartWorkspaceSourceQueryWithinLimit(value) && (mode === 'smart' || mode === 'gitlab')
        ? parseGitLabIssueOrMRLink(value)
        : null,
    [mode, value]
  )
  const rows = useMemo<RowEntry[]>(() => {
    const results = buildSmartWorkspaceSourceRows({
      branches: getVisibleBranchResults({
        branches,
        mode,
        resultRepoId: branchResultsSource?.repoId ?? null,
        resultQuery: branchResultsSource?.query ?? null,
        selectedRepoId: selectedRepo?.id ?? null,
        value
      }),
      githubItems: getVisibleHeldProviderResults({
        items: githubItems,
        value,
        debouncedQuery
      }),
      gitlabAvailable: gitlabSourceAvailable,
      gitlabItems: getVisibleHeldProviderResults({
        items: gitlabItems,
        value,
        debouncedQuery
      }),
      linearAvailable: false,
      linearIssues: [],
      githubUrlIntent,
      gitlabUrlIntent,
      mode,
      resultLimit: RESULT_LIMIT,
      value
    })
    return foundation.typedTextEnabled
      ? results
      : results.filter((row) => !isTypedTextSourceRow(row))
  }, [
    foundation.typedTextEnabled,
    branches,
    branchResultsSource,
    debouncedQuery,
    githubItems,
    githubUrlIntent,
    gitlabSourceAvailable,
    gitlabItems,
    gitlabUrlIntent,
    mode,
    selectedRepo?.id,
    value
  ])
  const { typedTextActionRow, searchResultRows } = useMemo(() => {
    const typedTextRow = rows.find(isTypedTextSourceRow) ?? null
    return {
      typedTextActionRow: typedTextRow,
      searchResultRows: typedTextRow ? rows.filter((row) => row !== typedTextRow) : rows
    }
  }, [rows])

  // Why: live input leads debounced search; freeze highlight until the query catches up.
  const valueWithinSourceLimit = isSmartWorkspaceSourceQueryWithinLimit(value)
  const debouncedQueryWithinSourceLimit = isSmartWorkspaceSourceQueryWithinLimit(debouncedQuery)
  const trimmedValue = valueWithinSourceLimit ? value.trim() : ''
  const trimmedDebouncedQuery = debouncedQueryWithinSourceLimit ? debouncedQuery.trim() : ''
  const isQueryStale = trimmedValue.length > 0 && trimmedDebouncedQuery !== trimmedValue
  // Why: unambiguous refs highlight their source row instead of the typed-text fallback.
  const sourceIntent = useMemo<'github' | 'gitlab' | null>(() => {
    if (!isSmartWorkspaceSourceQueryWithinLimit(value)) {
      return null
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    if (/^#\d+$/.test(trimmed) || parseGitHubIssueOrPRLink(trimmed) !== null) {
      return 'github'
    }
    if (parseGitLabIssueOrMRLink(trimmed) !== null) {
      return 'gitlab'
    }
    return null
  }, [value])
  const blockingTaskUrlResolution = isBlockingTaskUrlResolution({
    sourceIntent,
    isQueryStale,
    githubLoading,
    gitlabLoading
  })
  const resolvedCommandValue = resolveSmartWorkspaceCommandValue({
    currentValue: commandValue,
    rows,
    isQueryStale,
    sourceIntent
  })
  // Why: ignored stale cmdk changes must not reappear after the query settles.
  useEffect(() => {
    if (commandValue === resolvedCommandValue) {
      return
    }
    setCommandValue(resolvedCommandValue)
  }, [commandValue, resolvedCommandValue, setCommandValue])
  const loading = githubLoading || gitlabLoading || branchesLoading
  // Why: only spin on first load, not refreshes with retained rows.
  const showSearchSpinner = loading && searchResultRows.length === 0
  const ActiveInputIcon =
    mode === 'text' ? CaseSensitive : showSearchSpinner ? LoaderCircle : Search

  return {
    rows,
    typedTextActionRow,
    searchResultRows,
    isQueryStale,
    resolvedCommandValue,
    loading,
    showSearchSpinner,
    blockingTaskUrlResolution,
    ActiveInputIcon
  }
}
