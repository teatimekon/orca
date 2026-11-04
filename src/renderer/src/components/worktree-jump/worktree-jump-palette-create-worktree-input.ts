import type { WorktreeJumpPaletteFilter } from './use-worktree-jump-palette-filter'
import type { WorktreeJumpPaletteLocalState } from './use-worktree-jump-palette-local-state'
import type { WorktreeJumpPaletteQuickActions } from './use-worktree-jump-palette-quick-actions'
import type { WorktreeJumpPaletteSelectionLifecycle } from './use-worktree-jump-palette-selection-lifecycle'
import type { WorktreeJumpPaletteStoreState } from './use-worktree-jump-palette-store-state'

export type WorktreeJumpPaletteCreateWorktreeInput = Pick<
  WorktreeJumpPaletteStoreState,
  'workspaces' | 'closeModal' | 'openModal' | 'recordFeatureInteraction'
> &
  Pick<WorktreeJumpPaletteFilter, 'repoMap'> &
  Pick<
    WorktreeJumpPaletteLocalState,
    | 'createLookupGuard'
    | 'createWorktreeName'
    | 'liveQueryRef'
    | 'preserveCreateLookupOnCloseRef'
    | 'selectionMovedByUserRef'
    | 'skipRestoreFocusRef'
  > &
  Pick<WorktreeJumpPaletteQuickActions, 'prefetchCreateWorkspaceBaseForComposer'> &
  Pick<WorktreeJumpPaletteSelectionLifecycle, 'focusFallbackSurface'>
