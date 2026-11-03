import { PI_WEB_PANE_TAB_ID, piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { PiWebRow, PiWebStatusDelta } from '../../../../shared/pi-web/pi-web-status-types'
import type { AppState } from '@/store/types'
import { forgetPiWebRow, rememberPiWebRow } from './pi-web-row-registry'

type PiWebStatusStore = Pick<AppState, 'setAgentStatus' | 'removeAgentStatus'>

function applyPiWebRow(row: PiWebRow, store: PiWebStatusStore): void {
  const paneKey = rememberPiWebRow(row)
  const title = row.name ?? 'pi-web'
  store.setAgentStatus(
    paneKey,
    {
      state: row.state,
      prompt: title,
      agentType: 'pi-web',
      interrupted: false,
      sessionBoundary: false
    },
    title,
    // Main's row store is the ordered authority, so its clock may correct an earlier publication.
    { updatedAt: row.updatedAt, stateStartedAt: row.stateStartedAt, allowOlderTimestamp: true },
    { tabId: PI_WEB_PANE_TAB_ID, worktreeId: row.worktreeId },
    { terminalResumeEligible: false }
  )
}

export function applyPiWebDelta(delta: PiWebStatusDelta, store: PiWebStatusStore): void {
  for (const row of delta.upserts) {
    applyPiWebRow(row, store)
  }
  for (const sessionId of delta.removals) {
    // Fall back to the derived key so a row the registry lost (e.g. module reload) still goes away.
    store.removeAgentStatus(forgetPiWebRow(sessionId) ?? piWebPaneKey(sessionId))
  }
}

/** Snapshot rows are a baseline: they never overwrite a newer delta row nor resurrect a removed one. */
export function applyPiWebSnapshot(
  rows: readonly PiWebRow[],
  store: PiWebStatusStore & Pick<AppState, 'agentStatusByPaneKey'>,
  removedSinceSubscribe: ReadonlySet<string>
): void {
  const upserts = rows.filter((row) => {
    if (removedSinceSubscribe.has(row.sessionId)) {
      return false
    }
    const current = store.agentStatusByPaneKey[piWebPaneKey(row.sessionId)]
    return !current || current.updatedAt < row.updatedAt
  })
  applyPiWebDelta({ upserts, removals: [], events: [] }, store)
}
