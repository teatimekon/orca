import { describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { Repo } from '../../shared/repo-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { listPiWebWorkspaceIds } from './pi-web-workspace-ids'

function repo(over: Partial<Repo> & Pick<Repo, 'id' | 'path'>): Repo {
  return { displayName: over.id, badgeColor: '#000', addedAt: 1, ...over }
}

function meta(): WorktreeMeta {
  return {
    displayName: '',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1
  }
}

function folder(over: Partial<FolderWorkspace> & Pick<FolderWorkspace, 'id' | 'folderPath'>) {
  const workspace: FolderWorkspace = {
    projectGroupId: 'group',
    name: over.id,
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1,
    createdAt: 1,
    updatedAt: 1,
    ...over
  }
  return workspace
}

describe('listPiWebWorkspaceIds', () => {
  it('lists the sidebar ids of local git worktrees, folder repo instances and folder workspaces', () => {
    const repos = [
      repo({ id: 'app', path: '/w/app' }),
      repo({ id: 'code', path: '/w/code', kind: 'folder' }),
      repo({ id: 'remote', path: '/srv/app', connectionId: 'ssh-1' })
    ]
    const store = {
      getRepos: () => repos,
      getAllWorktreeMeta: () => ({
        'app::/w/app': meta(),
        'app::/w/app.wt/feature': meta(),
        'code::/w/code::workspace:0f9c2a64-1d2b-4c1e-9a7f-3b5d6e7f8a90': meta(),
        'remote::/srv/app.wt/x': meta()
      }),
      getFolderWorkspaces: () => [
        folder({ id: 'notes', folderPath: '/w/notes' }),
        folder({ id: 'far', folderPath: '/srv/notes', connectionId: 'ssh-1' })
      ],
      getProjectGroups: () => []
    }

    expect([...listPiWebWorkspaceIds(store)]).toEqual([
      'app::/w/app',
      'code::/w/code',
      'app::/w/app.wt/feature',
      'code::/w/code::workspace:0f9c2a64-1d2b-4c1e-9a7f-3b5d6e7f8a90',
      'folder:notes'
    ])
  })
})
