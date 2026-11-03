import { folderWorkspaceKey } from '../../shared/workspace-scope'
import { getVerifiedLocalFolderWorkspaceKeys } from '../memory/verified-local-folder-workspaces'
import type { Store } from '../persistence/loading-store/store'
import { loadKnownUsageWorktreesByRepo } from '../usage/usage-worktree-metadata'
import type { PiWebWorktreePathEntry } from './pi-web-worktree-index'

/** Local workspace roots keyed by the ids the sidebar uses: `repoId::path`, or `folder:<id>`. */
export function listPiWebWorktreePaths(
  store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta' | 'getFolderWorkspaces' | 'getProjectGroups'>
): PiWebWorktreePathEntry[] {
  const repos = store.getRepos()
  const entries: PiWebWorktreePathEntry[] = []
  for (const [root, ...listed] of loadKnownUsageWorktreesByRepo(store, repos).values()) {
    // Why: listed ids carry git's own path spelling, so they must win a tie with the repo-path root.
    for (const ref of root ? [...listed, root] : listed) {
      entries.push({ worktreeId: ref.worktreeId, path: ref.path })
    }
  }
  const folderWorkspaces = store.getFolderWorkspaces()
  const localKeys = getVerifiedLocalFolderWorkspaceKeys({
    folderWorkspaces,
    projectGroups: store.getProjectGroups(),
    repos
  })
  for (const workspace of folderWorkspaces) {
    const key = folderWorkspaceKey(workspace.id)
    if (localKeys.has(key)) {
      entries.push({ worktreeId: key, path: workspace.folderPath })
    }
  }
  return entries
}
