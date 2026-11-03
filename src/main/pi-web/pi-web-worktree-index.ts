import { resolve } from 'node:path'

export type PiWebWorktreePathEntry = {
  worktreeId: string
  path: string
}

export type PiWebWorktreeIndex = readonly PiWebWorktreePathEntry[]

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:[\\/]/

// Windows drive paths are normalized lexically (forward slashes, lowercase) so
// matching works regardless of the host platform; POSIX paths keep path.resolve.
function normalize(p: string): string {
  if (WINDOWS_DRIVE_PATH.test(p)) {
    const slashed = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
    const trimmed = slashed.length > 3 ? slashed.replace(/\/+$/, '') : slashed
    return trimmed.toLowerCase()
  }
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
    const prefix = entry.path.endsWith('/') ? entry.path : `${entry.path}/`
    if (target === entry.path || target.startsWith(prefix)) {
      return entry.worktreeId
    }
  }
  return null
}
