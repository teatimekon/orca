import { getRepoRoutingConnectionId } from '../../shared/execution-host'
import { getRepoMainWorktreeId, splitWorktreeId } from '../../shared/worktree/id'
import { folderWorkspaceKey } from '../../shared/workspace-scope'
import { getVerifiedLocalFolderWorkspaceKeys } from '../memory/verified-local-folder-workspaces'
import type { Store } from '../persistence/loading-store/store'

/** This desktop's workspaces by sidebar id: local repos' checkouts and instances (`repoId::path…`) and `folder:<id>`. */
export function listPiWebWorkspaceIds(
  store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta' | 'getFolderWorkspaces' | 'getProjectGroups'>
): Set<string> {
  const repos = store.getRepos()
  const localRepos = repos.filter((repo) => !getRepoRoutingConnectionId(repo))
  const localRepoIds = new Set(localRepos.map((repo) => repo.id))
  const ids = new Set(localRepos.map((repo) => getRepoMainWorktreeId(repo)))
  // Every listed checkout gets a meta entry, and folder repos key each workspace instance there.
  for (const worktreeId of Object.keys(store.getAllWorktreeMeta())) {
    const repoId = splitWorktreeId(worktreeId)?.repoId
    if (repoId !== undefined && localRepoIds.has(repoId)) {
      ids.add(worktreeId)
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
      ids.add(key)
    }
  }
  return ids
}
