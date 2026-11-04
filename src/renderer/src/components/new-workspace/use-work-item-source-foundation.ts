import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { buildTaskSourceContextFromRepo } from '../../../../shared/task-source-context'
import type {
  NormalizedWorkItemSourceSearchProps,
  RepoBackedSearchTarget
} from './smart-workspace-name-field-model'
import { useSmartWorkspaceFieldAvailability } from './use-smart-workspace-field-availability'
import { useWorkItemSourceState } from './use-work-item-source-state'

export function useWorkItemSourceFoundation(props: NormalizedWorkItemSourceSearchProps) {
  const {
    repos,
    repoId,
    githubSourceContext: githubSourceContextOverride,
    repoBackedSearchRepos,
    textOnly,
    value
  } = props
  const {
    fetchWorkItems,
    fetchWorkItemsAcrossRepos,
    getCachedWorkItems,
    preflightStatus,
    preflightStatusChecked,
    preflightStatusContextKey,
    expectedPreflightContextKey,
    refreshPreflightStatus
  } = useAppStore(
    useShallow((s) => ({
      fetchWorkItems: s.fetchWorkItems,
      fetchWorkItemsAcrossRepos: s.fetchWorkItemsAcrossRepos,
      getCachedWorkItems: s.getCachedWorkItems,
      preflightStatus: s.preflightStatus,
      preflightStatusChecked: s.preflightStatusChecked,
      preflightStatusContextKey: s.preflightStatusContextKey,
      expectedPreflightContextKey: localPreflightContextKey(getLocalPreflightContext(s)),
      refreshPreflightStatus: s.refreshPreflightStatus
    }))
  )
  const selectedRepo = useMemo(
    () =>
      props.selectedRepo !== undefined
        ? props.selectedRepo
        : (repos.find((repo) => repo.id === repoId) ?? null),
    [props.selectedRepo, repoId, repos]
  )
  const githubSourceContext = useMemo(() => {
    if (githubSourceContextOverride?.provider === 'github') {
      return githubSourceContextOverride
    }
    return selectedRepo
      ? buildTaskSourceContextFromRepo({
          provider: 'github',
          projectId: selectedRepo.id,
          repo: selectedRepo
        })
      : null
  }, [githubSourceContextOverride, selectedRepo])
  const gitlabSourceContext = useMemo(
    () =>
      props.gitlabSourceContext?.provider === 'gitlab'
        ? props.gitlabSourceContext
        : selectedRepo
          ? buildTaskSourceContextFromRepo({
              provider: 'gitlab',
              projectId: selectedRepo.id,
              repo: selectedRepo
            })
          : null,
    [props.gitlabSourceContext, selectedRepo]
  )
  const repoBackedSearchTargets = useMemo<RepoBackedSearchTarget[]>(
    () =>
      (repoBackedSearchRepos.length > 0
        ? repoBackedSearchRepos
        : selectedRepo
          ? [selectedRepo]
          : []
      ).map((repo) => ({
        repo,
        githubSourceContext:
          repo.id === selectedRepo?.id && githubSourceContext?.provider === 'github'
            ? githubSourceContext
            : buildTaskSourceContextFromRepo({
                provider: 'github',
                projectId: repo.id,
                repo
              }),
        gitlabSourceContext:
          repo.id === selectedRepo?.id && gitlabSourceContext?.provider === 'gitlab'
            ? gitlabSourceContext
            : buildTaskSourceContextFromRepo({
                provider: 'gitlab',
                projectId: repo.id,
                repo
              })
      })),
    [githubSourceContext, gitlabSourceContext, repoBackedSearchRepos, selectedRepo]
  )
  const state = useWorkItemSourceState(textOnly, value)
  const availability = useSmartWorkspaceFieldAvailability({
    props,
    state,
    repoBackedSearchTargets,
    preflightStatus,
    preflightStatusChecked,
    preflightStatusContextKey,
    expectedPreflightContextKey,
    refreshPreflightStatus
  })

  return {
    ...props,
    ...state,
    ...availability,
    fetchWorkItems,
    fetchWorkItemsAcrossRepos,
    getCachedWorkItems,
    selectedRepo,
    githubSourceContext,
    gitlabSourceContext,
    repoBackedSearchTargets
  }
}
