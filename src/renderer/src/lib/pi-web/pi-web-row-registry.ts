import { piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { PiWebRow } from '../../../../shared/pi-web/pi-web-status-types'

export type PiWebRowIdentity = { sessionId: string; worktreeId: string }

// Why: pane keys hash the session id, so clicks and notifications need this map to get the id back.
const rowsByPaneKey = new Map<string, PiWebRowIdentity>()

export function rememberPiWebRow(row: PiWebRow): string {
  const paneKey = piWebPaneKey(row.sessionId)
  rowsByPaneKey.set(paneKey, { sessionId: row.sessionId, worktreeId: row.worktreeId })
  return paneKey
}

export function forgetPiWebRow(sessionId: string): string | null {
  const paneKey = piWebPaneKey(sessionId)
  return rowsByPaneKey.delete(paneKey) ? paneKey : null
}

/** Drop entries whose status row left the store by any path (e.g. worktree removal), so lookups never go stale. */
export function forgetPiWebRowsAbsentFrom(
  agentStatusByPaneKey: Readonly<Record<string, unknown>>
): void {
  for (const paneKey of rowsByPaneKey.keys()) {
    if (!(paneKey in agentStatusByPaneKey)) {
      rowsByPaneKey.delete(paneKey)
    }
  }
}

export function lookupPiWebRow(paneKey: string): PiWebRowIdentity | null {
  return rowsByPaneKey.get(paneKey) ?? null
}
