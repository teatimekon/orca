/**
 * zyx/orca-pure: repo-relative paths deleted from the tree, so the upgrade script can resolve an upstream
 * modify/delete conflict on any of them as "keep deleted". `/**` at the end = anything below; `*` = any run
 * of characters inside one path segment; a leading `!` keeps a path an earlier pattern matched.
 */
export const PURE_DELETED_PATHS: readonly string[] = [
  // O14a (Task 14)
  'src/renderer/src/components/task-page/**',
  'src/renderer/src/components/linear-*',
  'src/renderer/src/components/Linear*',
  'src/renderer/src/components/jira-*',
  'src/renderer/src/components/Jira*',
  'src/renderer/src/components/use-jira-*',
  'src/renderer/src/components/use-new-linear-issue-projects.ts',
  'src/renderer/src/components/__mocks__/jira-*',
  'src/renderer/src/components/__mocks__/task-page-*',
  'src/renderer/src/components/integrations/task-trackers/**',
  'src/renderer/src/components/new-workspace/*jira*',
  'src/renderer/src/components/new-workspace/*linear*',
  'src/renderer/src/components/settings/skills/linear/**',
  'src/renderer/src/components/settings/tasks/**',
  'src/renderer/src/components/settings/integrations/**',
  'src/renderer/src/components/settings/repository/RepositoryJiraProjectSection*',
  'src/renderer/src/components/sidebar/linear-agent-skill-*',
  'src/renderer/src/components/sidebar/LinearAgentSkillSetup*',
  'src/renderer/src/components/sidebar/SidebarTaskNavButton*',
  'src/renderer/src/components/sidebar/worktree-card-jira-issue-display.ts',
  'src/renderer/src/components/sidebar/*workspace-board-task-status-sync*',
  'src/renderer/src/components/skills/setup/linear-agent-skill-install-cta*',
  'src/renderer/src/components/skills/setup/WslLinearAgentSkillInstallCta.tsx',
  'src/renderer/src/components/github-item-dialog/**',
  'src/renderer/src/components/pull-request-page/**',
  'src/renderer/src/components/github-project/**',
  'src/renderer/src/components/PullRequestPage.tsx',
  'src/renderer/src/components/GitHubItemDialog.tsx',
  'src/renderer/src/components/cmd-j/task-search-*',
  'src/renderer/src/components/worktree-jump/use-worktree-jump-palette-task-*',
  'src/renderer/src/components/worktree-jump/WorktreeJumpPalette.task-search.test.tsx',
  'src/renderer/src/components/worktree-jump/WorktreeJumpPalette.linear-url.test.tsx',
  'src/renderer/src/components/task-project-source-combobox*',
  'src/renderer/src/components/use-task-creation-draft-retention*',
  'src/renderer/src/components/provider-check-classification-parity.test.ts',
  'src/renderer/src/components/connect-dialog-outside-dismiss.test.tsx',
  'src/renderer/src/hooks/linear-issue-committed-state.ts',
  'src/renderer/src/hooks/use-linear-agent-skill-setup.ts',
  'src/renderer/src/hooks/useLinearIssuePublication.ts',
  'src/renderer/src/hooks/useLinearProviderConnected.ts',
  'src/renderer/src/hooks/useTaskPageGitHubWorkItemMutation.ts',
  'src/renderer/src/hooks/use-integration-provider-status-refresh*',
  'src/renderer/src/lib/jira-*',
  'src/renderer/src/lib/linear-*',
  'src/renderer/src/lib/cmd-j-linear-issue-intent*',
  'src/renderer/src/runtime/*jira*',
  'src/renderer/src/runtime/*linear*',
  'src/renderer/src/store/slices/jira*',
  'src/renderer/src/store/slices/linear*',
  'src/renderer/src/store/slices/linear/**',
  'src/renderer/src/web/preload-api/web-jira*',
  'src/preload/api/linear-*',
  'src/preload/api/jira-*',
  'src/main/linear/**',
  'src/main/jira/**',
  'src/main/ipc/linear/**',
  'src/main/ipc/jira/**',
  'src/main/runtime/runtime-linear-*',
  'src/main/runtime/runtime-jira-*',
  'src/main/runtime/linear-save-*',
  'src/main/runtime/linear-issue-description-comparison.ts',
  'src/main/runtime/integrations/linear/**',
  'src/main/runtime/rpc/methods/jira-attachment-image*',
  'src/main/runtime/rpc/methods/jira*.test.ts',
  'src/main/runtime/rpc/methods/linear*.test.ts',
  'src/main/runtime/rpc/methods/linear-agent-project-access.spec.ts',
  'src/main/runtime/rpc/methods/linear-issue-list-method.ts',
  'src/main/runtime/rpc/methods/linear-project-create.ts',
  'src/main/text-generation/jira-*',
  '!src/renderer/src/components/task-page/github/task-page-github-work-item-status.ts',
  '!src/renderer/src/components/task-page/github/task-page-github-work-item-mutation-registry.ts',
  '!src/renderer/src/components/task-page/github/task-page-github-work-item-registry-types.ts',
  '!src/renderer/src/components/task-page/github/task-page-github-work-item-mutation-keys.ts',
  '!src/renderer/src/components/task-page/github/task-page-github-work-item-quiet-state.ts',
  '!src/renderer/src/components/task-page/github/task-page-github-confirmed-client-values.ts',
  '!src/renderer/src/components/github-project/project-work-item.ts',
  '!src/renderer/src/components/github-item-dialog/load-item-details/github-work-item-target-context.ts',
  '!src/renderer/src/components/github-item-dialog/load-item-details/work-item-details-cache.ts',
  // exact paths of files emptied or orphaned by the deletions above
  'tests/e2e/SmartWorkspaceSourceResultList.linear-auth.test.tsx',
  'tests/e2e/SmartWorkspaceSourceResultList.linear-auth.unit.test.ts',
  'tests/e2e/SmartWorkspaceSourceResultList.linear-read-error.test.tsx',
  'tests/e2e/SmartWorkspaceSourceResultList.linear-read-error.unit.test.ts',
  'tests/e2e/github-project-provider-columns.unit.test.ts',
  'tests/e2e/jira-panel-layout.spec.ts',
  'tests/e2e/linear-cli-recovery.unit.test.ts',
  'tests/e2e/linear-issue-view-persistence.spec.ts',
  'tests/e2e/linear-private-images.spec.ts',
  'tests/e2e/linear-store.unit.test.ts',
  'tests/e2e/linear-url-workspace-entry.spec.ts',
  'tests/e2e/linear-write-lifetime.unit.test.ts',
  'tests/e2e/smart-workspace-linear-read-test-fixtures.tsx',
  'tests/e2e/task-page-linear-refresh-authority.test.tsx',
  'tests/e2e/task-page-linear-refresh-authority.unit.test.ts',
  'tests/e2e/task-page-linear-refresh-transport.test.tsx',
  'tests/e2e/task-page-linear-refresh-transport.unit.test.ts',
  'src/renderer/src/hooks/composer-state/jira-mapped-owner-flow.integration.test.tsx',
  'src/renderer/src/components/worktree-jump/worktree-jump-palette-task-row.tsx',
  'src/renderer/src/components/worktree-jump/worktree-jump-palette-task-search-status.tsx',
  'src/renderer/src/store/github/check-details-loader-test-fixture.ts',
  'src/renderer/src/store/github/check-details-failure-mapping.test.ts',
  'src/renderer/src/store/github/check-details-ingestion.test.ts',
  'src/renderer/src/components/cmd-j/task-search.test-fixture.ts',
  'src/renderer/src/components/sidebar/WorkspaceKanbanDrawer.task-status-sync.test.tsx',
  'src/renderer/src/lib/launch-work-item-direct-accepted.test.tsx',
  'src/renderer/src/lib/direct-work-item-setup-callers.test.tsx',
  'src/renderer/src/components/editor/combined-diff-cursor-reveal.test.tsx',
  'src/renderer/src/components/editor/combined-diff-review-host.test-fixture.ts',
  'src/renderer/src/components/github/GitHubMarkdownComposer.test.tsx',
  'src/renderer/src/components/github/github-work-item-issue-target.test.ts',
  'src/renderer/src/store/slices/github-work-items-twin-cache-host.test.ts',
  'src/renderer/src/components/new-workspace/work-item-source-selection.test.ts',
  'src/renderer/src/components/sidebar/WorkspaceAttachmentSearch.resolution.test.tsx',
  // O8 (Task 15)
  'src/main/automations/**',
  '!src/main/automations/workspace-provenance.ts',
  '!src/main/automations/dispatch-tokens.ts',
  '!src/main/automations/automation-owner-migration.ts',
  '!src/main/automations/automation-ssh-readoption-migration.ts',
  'src/main/ipc/automations.ts',
  'src/main/ipc/automations-*.test.ts',
  'src/main/ipc/wsl/wsl-host-automation-wake-*',
  'src/main/wsl/host-lifecycle/wsl-host-automation-wake*',
  'src/main/orcad/orcad-automations*',
  'src/main/startup/main-process-automations*',
  'src/main/runtime/runtime-automation-*',
  'src/main/runtime/automation-change-publication.test.ts',
  'src/main/runtime/orca-runtime-automations.spec.ts',
  'src/main/runtime/runtime-rpc-mobile-automations.test.ts',
  'src/main/runtime/workspaces/persisted-surfaces/automation-api-operations*',
  'src/main/runtime/rpc/methods/automation-*.test.ts',
  'src/main/persistence/applying-settings/persistence-automation-mode-precondition.test.ts',
  'src/main/persistence/applying-settings/persistence-legacy-automation-twin-host.test.ts',
  'src/preload/api/automation-api.ts',
  'src/preload/api/automations-bridge.ts',
  'src/renderer/src/components/automations/**',
  'src/renderer/src/components/settings/automations/**',
  'src/renderer/src/components/sidebar/WorktreeCardAutomationDetailSection*',
  'src/renderer/src/hooks/automation-*',
  'src/renderer/src/hooks/useAutomationDispatchEvents*',
  'src/renderer/src/lib/automation-session-*',
  'src/renderer/src/lib/automation-terminal-*',
  'src/renderer/src/lib/automations-changed-window-event*',
  'src/renderer/src/lib/launch-agent-background-session*',
  'src/renderer/src/lib/adopt-agent-background-session-tab*',
  'src/renderer/src/lib/agent-background-session-launch-host*',
  'src/renderer/src/ssh/ssh-host-moved-automations-copy*',
  'tests/e2e/automation-chat-reopen.unit.test.ts',
  'tests/e2e/automation-hidden-terminal-first-mount.spec.ts',
  'tests/e2e/automation-prompt-disclosure.spec.ts',
  'tests/e2e/automation-save-fallback.unit.test.ts',
  'tests/e2e/headless-automation-agent-launch.unit.test.ts',
  'tests/e2e/helpers/automation-chat-renderer-test-harness.ts',
  'tests/e2e/helpers/automation-chat-reopen-test-harness.ts',
  'tests/e2e/helpers/automation-chat-reuse-test-harness.ts',
  'tests/e2e/launch-agent-background-session-remote.unit.test.ts',
  'tests/e2e/persistence-automation-target-dispatch.unit.test.ts',
  'tests/e2e/ssh-orcad-enabled-automation-move.spec.ts',
  // O14b follow-up (fix round 4)
  'src/renderer/src/components/settings/source-control/git-provider-api-budget-search.ts'
]

function patternToRegExp(pattern: string): RegExp {
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '*' && pattern[i + 1] === '*') {
      source += '.*'
      i++
    } else if (char === '*') {
      source += '[^/]*'
    } else {
      source += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${source}$`)
}

export function pureDeletedPathMatcher(patterns: readonly string[]): (repoPath: string) => boolean {
  const compiled = patterns.map((pattern) =>
    pattern.startsWith('!')
      ? { keep: true, regExp: patternToRegExp(pattern.slice(1)) }
      : { keep: false, regExp: patternToRegExp(pattern) }
  )
  return (repoPath) => {
    let deleted = false
    for (const entry of compiled) {
      if (entry.regExp.test(repoPath)) {
        deleted = !entry.keep
      }
    }
    return deleted
  }
}
