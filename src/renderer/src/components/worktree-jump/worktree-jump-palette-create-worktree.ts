import { worktreeMatchesGitHubNumber } from '@/lib/github-work-item-workspace-attachment'
import { getPaletteWorktreeExecutionHostId } from '@/lib/palette-repo-resolution'
import { findRepoForHost } from '@/store/slices/repo-host-identity'
import { parseGitHubIssueOrPRNumber } from '../../../../shared/github/links'
import {
  getLinkedWorkItemSuggestedName,
  getLinkedWorkItemWorkspaceName
} from '../../../../shared/workspace-name'
import type { WorktreeJumpPaletteCreateWorktreeInput } from './worktree-jump-palette-create-worktree-input'
import { lookupGitHubWorkItemForSource } from '@/lib/github-work-item-source-lookup'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { queueWorkspaceActivationTerminalFocus } from '@/lib/workspace-activation-terminal-focus'
import { getRepoMapFromState } from '@/store/selectors'
import { useAppStore } from '@/store/index'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { buildTaskSourceContextFromRepo } from '../../../../shared/task-source-context'
import { isWorktreePaletteCreateActivationAllowed } from '@/lib/worktree-palette-create-action'

export function createWorktreeJumpPaletteWorktreeHandler({
  workspaces,
  closeModal,
  createLookupGuard,
  createWorktreeName,
  focusFallbackSurface,
  liveQueryRef,
  openModal,
  prefetchCreateWorkspaceBaseForComposer,
  preserveCreateLookupOnCloseRef,
  recordFeatureInteraction,
  repoMap,
  selectionMovedByUserRef,
  skipRestoreFocusRef
}: WorktreeJumpPaletteCreateWorktreeInput): () => void {
  return () => {
    const trimmed = createWorktreeName.trim()
    if (liveQueryRef.current.trim() !== trimmed) {
      return
    }
    if (
      !isWorktreePaletteCreateActivationAllowed({
        hasTaskUrlIntent: false,
        hasCreateName: trimmed.length > 0,
        selectionMovedByUser: selectionMovedByUserRef.current
      })
    ) {
      return
    }
    const ghNumber = parseGitHubIssueOrPRNumber(trimmed)
    const openComposer = (data: Record<string, unknown>): void => {
      skipRestoreFocusRef.current = true
      prefetchCreateWorkspaceBaseForComposer(
        typeof data.initialRepoId === 'string' ? data.initialRepoId : undefined
      )
      closeModal()
      recordFeatureInteraction('cmd-j-create-workspace')
      queueMicrotask(() =>
        openModal('new-workspace-composer', { ...data, telemetrySource: 'command_palette' })
      )
    }

    if (ghNumber !== null) {
      const state = useAppStore.getState()
      const matches = workspaces.filter(
        (worktree) =>
          !worktree.isArchived &&
          worktreeMatchesGitHubNumber(
            worktree,
            ghNumber,
            findRepoForHost(state.repos, worktree.repoId, {
              hostId: getPaletteWorktreeExecutionHostId(worktree),
              settings: state.settings
            }) ?? undefined
          )
      )
      const activeMatch =
        matches.find((worktree) => worktree.repoId === state.activeRepoId) ?? matches[0]
      if (activeMatch) {
        const executionHostId = getPaletteWorktreeExecutionHostId(activeMatch)
        const activation = activateAndRevealWorkspace(
          activeMatch.id,
          executionHostId ? { executionHostId } : {}
        )
        if (!activation) {
          return
        }
        skipRestoreFocusRef.current = true
        closeModal()
        if (!queueWorkspaceActivationTerminalFocus(activeMatch.id, activation)) {
          focusFallbackSurface()
        }
        recordFeatureInteraction('cmd-j-workspace-open')
        return
      }
      const repo =
        (state.activeRepoId ? (repoMap.get(state.activeRepoId) ?? null) : null) ||
        [...getRepoMapFromState(state).values()].find((candidate) => isGitRepoKind(candidate))
      if (!repo || !isGitRepoKind(repo)) {
        openComposer({ prefilledName: trimmed })
        return
      }
      prefetchCreateWorkspaceBaseForComposer(repo.id)
      const sourceContext = buildTaskSourceContextFromRepo({
        provider: 'github',
        projectId: repo.id,
        repo
      })
      const token = createLookupGuard.start()
      preserveCreateLookupOnCloseRef.current = true
      skipRestoreFocusRef.current = true
      recordFeatureInteraction('cmd-j-create-workspace')
      closeModal()
      void lookupGitHubWorkItemForSource({
        repoPath: repo.path,
        repoId: repo.id,
        sourceContext,
        number: ghNumber
      })
        .then((item) => {
          if (!createLookupGuard.isCurrent(token)) {
            return
          }
          const linkedWorkItem = item
            ? { type: item.type, number: item.number, title: item.title, url: item.url }
            : null
          queueMicrotask(() =>
            openModal('new-workspace-composer', {
              initialRepoId: repo.id,
              ...(linkedWorkItem
                ? {
                    linkedWorkItem,
                    prefilledName:
                      getLinkedWorkItemWorkspaceName(linkedWorkItem)?.seedName ??
                      getLinkedWorkItemSuggestedName({ title: linkedWorkItem.title })
                  }
                : { prefilledName: trimmed }),
              telemetrySource: 'command_palette'
            })
          )
        })
        .catch(() => {
          if (createLookupGuard.isCurrent(token)) {
            queueMicrotask(() =>
              openModal('new-workspace-composer', {
                initialRepoId: repo.id,
                prefilledName: trimmed,
                telemetrySource: 'command_palette'
              })
            )
          }
        })
      return
    }
    openComposer(trimmed ? { prefilledName: trimmed } : {})
  }
}
