import { resolveWorkItemSourceRow } from './work-item-source-selection'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isSmartWorkspaceSourceQueryWithinLimit } from '../../../../shared/new-workspace/smart-workspace-source-results'
import {
  EMPTY_REPO_SEARCH_REPOS,
  type NormalizedWorkItemSourceSearchProps,
  type WorkItemSourceSearchProps
} from './smart-workspace-name-field-model'
import { useWorkItemSourceFoundation } from './use-work-item-source-foundation'
import { useSmartWorkspaceGithubSearch } from './use-smart-workspace-github-search'
import { useSmartWorkspaceGitlabSearch } from './use-smart-workspace-gitlab-search'
import { useWorkItemSourcePresentation } from './use-work-item-source-presentation'
import { useSmartWorkspaceSecondarySearches } from './use-smart-workspace-secondary-searches'

export function useWorkItemSourceSearch({
  disabled = false,
  textOnly = false,
  branchesEnabled = true,
  repoBackedSourcesDisabled = false,
  repoBackedSearchRepos = EMPTY_REPO_SEARCH_REPOS,
  crossRepoSwitchTarget = 'project',
  ...props
}: WorkItemSourceSearchProps) {
  // Why: translate()-based options must refresh on language changes without remounting.
  useTranslation()
  const normalizedProps: NormalizedWorkItemSourceSearchProps = {
    ...props,
    disabled,
    textOnly,
    branchesEnabled,
    repoBackedSourcesDisabled,
    repoBackedSearchRepos,
    crossRepoSwitchTarget
  }
  const foundation = useWorkItemSourceFoundation(normalizedProps)
  const sourceQueryWithinLimit = useMemo(
    () => isSmartWorkspaceSourceQueryWithinLimit(foundation.debouncedQuery),
    [foundation.debouncedQuery]
  )
  const shouldQueryGithub =
    sourceQueryWithinLimit &&
    !repoBackedSourcesDisabled &&
    !textOnly &&
    foundation.repoBackedSearchTargets.length > 0 &&
    (foundation.mode === 'smart' || foundation.mode === 'github')

  useSmartWorkspaceGithubSearch({
    foundation,
    sourceQueryWithinLimit,
    shouldQueryGithub
  })
  useSmartWorkspaceSecondarySearches({ foundation })
  const shouldQueryGitlab =
    sourceQueryWithinLimit &&
    !repoBackedSourcesDisabled &&
    !textOnly &&
    foundation.gitlabSourceAvailable &&
    foundation.repoBackedSearchTargets.length > 0 &&
    (foundation.mode === 'smart' || foundation.mode === 'gitlab')
  useSmartWorkspaceGitlabSearch({
    foundation,
    sourceQueryWithinLimit,
    shouldQueryGitlab
  })
  const presentation = useWorkItemSourcePresentation(foundation)
  const resolveRow = useCallback(
    (row: (typeof presentation.rows)[number]) =>
      resolveWorkItemSourceRow(row, {
        github: foundation.githubSourceContext,
        gitlab: foundation.gitlabSourceContext ?? null
      }),
    [foundation.githubSourceContext, foundation.gitlabSourceContext]
  )
  return {
    ...foundation,
    ...presentation,
    resolveRow
  }
}

export type WorkItemSourceSearch = ReturnType<typeof useWorkItemSourceSearch>
