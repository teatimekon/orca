import { describe, expect, it } from 'vitest'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  getWorkspaceHoverAttachments,
  getWorkspaceLinkedItemRows
} from './workspace-hover-attachments'

const workspace = {
  id: 'repo::/repo/feature',
  repoId: 'repo',
  path: '/repo/feature',
  displayName: 'Feature',
  branch: 'feature',
  linkedPR: 57,
  linkedItems: [
    { provider: 'github', type: 'pr', number: 57, url: 'https://github.com/acme/orca/pull/57' },
    { provider: 'github', type: 'issue', number: 12, url: 'https://github.com/acme/orca/issues/12' }
  ]
} as unknown as Worktree

describe('hover attachments in the pure build (hosted source control off)', () => {
  it('lists no saved hosted PR or issue links', () => {
    expect(getWorkspaceHoverAttachments(workspace, { review: null }).items).toEqual([])
    expect(getWorkspaceLinkedItemRows(workspace, { review: null }, undefined)).toEqual([])
  })
})
