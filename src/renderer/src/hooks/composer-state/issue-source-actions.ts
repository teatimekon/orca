import type { ComposerModel } from './composer-model'

type IssueSourceActionsInput = Pick<
  ComposerModel,
  | 'baseBranch'
  | 'baseBranchNamesWorkspace'
  | 'branchAutoNameRef'
  | 'isProjectGroupTarget'
  | 'lastAutoNameRef'
  | 'lastAutoNoteRef'
  | 'linkedWorkItem'
  | 'name'
  | 'noteRef'
  | 'setBaseBranch'
  | 'setBranchNameOverride'
  | 'setBranchNameOverridePreservesNameEdits'
  | 'setCompareBaseRef'
  | 'setForkPushWarning'
  | 'setLinkedGitLabIssue'
  | 'setLinkedGitLabMR'
  | 'setLinkedIssue'
  | 'setLinkedPR'
  | 'setLinkedTaskSourceContext'
  | 'setLinkedWorkItem'
  | 'setName'
  | 'setNote'
  | 'setPushTarget'
  | 'setReuseEligibleBranch'
  | 'setReuseSelectedBranch'
  | 'setStartFromResetHint'
  | 'smartSourceSelectionRef'
>

import { useCallback, useMemo } from 'react'
import { getSmartNameSelection as getFolderSmartNameSelection } from '@/components/sidebar/folder-workspace-composer-helpers'
import { buildWorkspaceSourceSelection } from '../../../../shared/new-workspace/workspace-source'
import type { SmartWorkspaceNameSelection } from '@/components/new-workspace/smart-workspace-name-field-model'

export function useIssueSourceActions(input: IssueSourceActionsInput) {
  const {
    baseBranch,
    baseBranchNamesWorkspace,
    branchAutoNameRef,
    isProjectGroupTarget,
    lastAutoNameRef,
    lastAutoNoteRef,
    linkedWorkItem,
    name,
    noteRef,
    setBaseBranch,
    setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits,
    setCompareBaseRef,
    setForkPushWarning,
    setLinkedGitLabIssue,
    setLinkedGitLabMR,
    setLinkedIssue,
    setLinkedPR,
    setLinkedTaskSourceContext,
    setLinkedWorkItem,
    setName,
    setNote,
    setPushTarget,
    setReuseEligibleBranch,
    setReuseSelectedBranch,
    setStartFromResetHint,
    smartSourceSelectionRef
  } = input

  const handleClearSmartNameSelection = useCallback((): void => {
    smartSourceSelectionRef.current = null
    setLinkedIssue('')
    setLinkedPR(null)
    setLinkedGitLabIssue(null)
    setLinkedGitLabMR(null)
    setLinkedWorkItem(null)
    setLinkedTaskSourceContext(null)
    if (baseBranchNamesWorkspace) {
      setBaseBranch(undefined)
    }
    setCompareBaseRef(undefined)
    setPushTarget(undefined)
    setBranchNameOverride(undefined)
    setBranchNameOverridePreservesNameEdits(false)
    setReuseEligibleBranch(null)
    setReuseSelectedBranch(false)
    setForkPushWarning(null)
    branchAutoNameRef.current = ''
    setStartFromResetHint(null)
    if (name === lastAutoNameRef.current) {
      setName('')
      lastAutoNameRef.current = ''
    }
    if (noteRef.current === lastAutoNoteRef.current) {
      setNote('')
      lastAutoNoteRef.current = ''
    }
  }, [
    name,
    baseBranchNamesWorkspace,
    branchAutoNameRef,
    lastAutoNameRef,
    lastAutoNoteRef,
    noteRef,
    setBaseBranch,
    setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits,
    setCompareBaseRef,
    setForkPushWarning,
    setLinkedGitLabIssue,
    setLinkedGitLabMR,
    setLinkedIssue,
    setLinkedPR,
    setLinkedTaskSourceContext,
    setLinkedWorkItem,
    setName,
    setNote,
    setPushTarget,
    setReuseEligibleBranch,
    setReuseSelectedBranch,
    setStartFromResetHint,
    smartSourceSelectionRef
  ])

  const smartNameSelection = useMemo<SmartWorkspaceNameSelection | null>(() => {
    if (isProjectGroupTarget) {
      return getFolderSmartNameSelection(linkedWorkItem)
    }
    return buildWorkspaceSourceSelection({
      linkedWorkItem,
      // Why: only a branch picked to NAME the workspace becomes a source pill; a base ref
      // chosen in the composer's own picker must leave a typed name on screen.
      baseBranch: baseBranchNamesWorkspace ? baseBranch : undefined
    }) as SmartWorkspaceNameSelection | null
  }, [baseBranch, baseBranchNamesWorkspace, isProjectGroupTarget, linkedWorkItem])

  return {
    handleClearSmartNameSelection,
    smartNameSelection
  }
}
