import { describe, expect, it } from 'vitest'
import { buildPiWebWorktreeIndex, resolvePiWebWorktreeId } from './pi-web-worktree-index'

describe('pi-web worktree index', () => {
  it('respects path boundaries', () => {
    const index = buildPiWebWorktreeIndex([{ worktreeId: 'wt1', path: '/x/hw_experiment' }])
    expect(resolvePiWebWorktreeId(index, '/x/hw_experiment2')).toBeNull()
    expect(resolvePiWebWorktreeId(index, '/x/hw_experiment/docs/a')).toBe('wt1')
    expect(resolvePiWebWorktreeId(index, '/x/hw_experiment/')).toBe('wt1')
  })

  it('prefers the longest match', () => {
    const index = buildPiWebWorktreeIndex([
      { worktreeId: 'code', path: '/x/code' },
      { worktreeId: 'hw', path: '/x/code/hw' }
    ])
    expect(resolvePiWebWorktreeId(index, '/x/code/hw/a')).toBe('hw')
    expect(resolvePiWebWorktreeId(index, '/x/code/other')).toBe('code')
  })

  it('matches windows paths with backslashes', () => {
    const index = buildPiWebWorktreeIndex([{ worktreeId: 'w', path: 'C:\\code\\hw' }])
    expect(resolvePiWebWorktreeId(index, 'C:\\code\\hw\\docs')).toBe('w')
    expect(resolvePiWebWorktreeId(index, 'C:\\code\\hw\\')).toBe('w')
    expect(resolvePiWebWorktreeId(index, 'C:\\code\\hw2')).toBeNull()
  })

  it('windows drive letters compare case-insensitively', () => {
    const index = buildPiWebWorktreeIndex([{ worktreeId: 'w', path: 'c:\\Code\\HW' }])
    expect(resolvePiWebWorktreeId(index, 'C:\\code\\hw\\a')).toBe('w')
  })
})
