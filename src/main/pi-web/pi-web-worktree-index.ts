import { resolve } from 'node:path'

export type PiWebWorktreePathEntry = {
  worktreeId: string
  path: string
}

export type PiWebWorktreeIndex = readonly PiWebWorktreePathEntry[]

function normalize(p: string): string {
  const resolved = resolve(p)
  return resolved.length > 1 ? resolved.replace(/\/+$/, '') : resolved
}

export function buildPiWebWorktreeIndex(entries: PiWebWorktreePathEntry[]): PiWebWorktreeIndex {
  return entries
    .map((e) => ({ worktreeId: e.worktreeId, path: normalize(e.path) }))
    .sort((a, b) => b.path.length - a.path.length)
}

export function resolvePiWebWorktreeId(index: PiWebWorktreeIndex, cwd: string): string | null {
  if (!cwd) {
    return null
  }
  const target = normalize(cwd)
  for (const entry of index) {
    const prefix = entry.path === '/' ? '/' : `${entry.path}/`
    if (target === entry.path || target.startsWith(prefix)) {
      return entry.worktreeId
    }
  }
  return null
}
