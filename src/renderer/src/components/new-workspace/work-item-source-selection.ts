import type { TaskSourceContext } from '../../../../shared/task-source-context'
import {
  buildGitHubWorkspaceSource,
  buildGitLabWorkspaceSource,
  type WorkspaceSourceLinkedItem
} from '../../../../shared/new-workspace/workspace-source'
import { parseGitHubIssueOrPRLink } from '../../../../shared/github/links'
import { parseGitLabIssueOrMRLink } from '../../../../shared/new-workspace/gitlab-links'
import type { RowEntry } from './smart-workspace-name-field-model'

export type WorkItemSourceContexts = Record<'github' | 'gitlab', TaskSourceContext | null>
export function resolveWorkItemSourceRow(
  row: RowEntry,
  contexts: WorkItemSourceContexts
):
  | (WorkspaceSourceLinkedItem & { identifier?: string; taskSourceContext?: TaskSourceContext })
  | null {
  if (row.kind === 'github' || row.kind === 'gitlab') {
    const { type, number, title, url, repoId } = row.item
    const source =
      row.kind === 'github'
        ? buildGitHubWorkspaceSource({ ...row.item, type: row.item.type })
        : buildGitLabWorkspaceSource(row.item)
    const context = contexts[row.kind]
    const github = row.kind === 'github' ? parseGitHubIssueOrPRLink(url) : null
    const gitlab = row.kind === 'gitlab' ? parseGitLabIssueOrMRLink(url) : null
    const identity = github
      ? { provider: 'github' as const, ...github.slug }
      : gitlab
        ? { provider: 'gitlab' as const, webUrl: `${new URL(url).origin}/${gitlab.slug.path}` }
        : context?.providerIdentity
    return {
      provider: source.provider,
      type,
      number,
      title,
      url,
      repoId,
      taskSourceContext: context ? { ...context, providerIdentity: identity } : undefined
    }
  }
  return null
}
