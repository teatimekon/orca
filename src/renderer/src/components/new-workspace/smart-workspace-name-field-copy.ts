import { translate } from '@/i18n/i18n'
import type { SmartNameMode } from '../../../../shared/new-workspace/smart-workspace-source-results'

export function getSmartWorkspaceNameFieldCopy({
  crossRepoSwitchTarget,
  disabled,
  disabledPlaceholder,
  mode
}: {
  repoBackedSourcesDisabled: boolean
  branchesEnabled: boolean
  crossRepoSwitchTarget: 'project' | 'task-source'
  disabled: boolean
  disabledPlaceholder?: string
  mode: SmartNameMode
}) {
  // zyx/orca-pure: the catalog's other placeholders name Jira, so every branch reuses the plain one.
  const smartPlaceholder = translate(
    'auto.components.new.workspace.SmartWorkspaceNameField.placeholderWorkspaceName',
    'Type a workspace name'
  )
  const crossRepoSwitchIsTaskSource = crossRepoSwitchTarget === 'task-source'
  const crossRepoSwitchTitle = crossRepoSwitchIsTaskSource
    ? translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.switchTaskSourceTitle',
        'Switch task source?'
      )
    : translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.4bd98f1091',
        'Switch project?'
      )
  const formatCrossRepoSwitchDescription = (repoSlug: string): string =>
    crossRepoSwitchIsTaskSource
      ? translate(
          'auto.components.new.workspace.SmartWorkspaceNameField.crossRepoDifferentTaskSource',
          'The GitHub URL points to {{repo}}, which is different from the selected task source.',
          { repo: repoSlug }
        )
      : translate(
          'auto.components.new.workspace.SmartWorkspaceNameField.crossRepoDifferentProject',
          'The GitHub URL points to {{repo}}, which is different from the selected project.',
          { repo: repoSlug }
        )
  const crossRepoSwitchFallbackLabel = crossRepoSwitchIsTaskSource
    ? translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.currentTaskSource',
        'current task source'
      )
    : translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.fda67f0b61',
        'current project'
      )
  const placeholder = disabled
    ? (disabledPlaceholder ??
      translate('auto.components.new.workspace.SmartWorkspaceNameField.unavailable', 'Unavailable'))
    : mode === 'smart'
      ? smartPlaceholder
      : mode === 'github'
        ? translate(
            'auto.components.new.workspace.SmartWorkspaceNameField.searchGitHub',
            'Search GitHub PRs and issues'
          )
        : mode === 'gitlab'
          ? translate(
              'auto.components.new.workspace.SmartWorkspaceNameField.searchGitLab',
              'Search GitLab MRs and issues'
            )
          : mode === 'branches'
            ? translate(
                'auto.components.new.workspace.SmartWorkspaceNameField.searchBranches',
                'Search branches'
              )
            : translate(
                'auto.components.new.workspace.SmartWorkspaceNameField.workspaceName',
                'Workspace name'
              )

  return {
    crossRepoSwitchTitle,
    formatCrossRepoSwitchDescription,
    crossRepoSwitchFallbackLabel,
    placeholder
  }
}
