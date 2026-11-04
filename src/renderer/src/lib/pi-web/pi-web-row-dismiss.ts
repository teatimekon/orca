import { lookupPiWebRow } from './pi-web-row-registry'

/** Tells main to forget a dismissed pi-web row. Call before the store drop, which clears the registry entry. */
export function dismissPiWebRow(paneKey: string): void {
  const row = lookupPiWebRow(paneKey)
  // Partial window.api stubs (renderer test harnesses) omit this namespace.
  if (!row || !window.api.piWeb) {
    return
  }
  window.api.piWeb.dismiss(row.sessionId).catch((error: unknown) => {
    console.warn('[pi-web] failed to dismiss row', error)
  })
}

/** Dismisses a sidebar agent row: forgets it in main if it is pi-web, then drops local state (order matters, see above). */
export function dismissAgentRow(
  paneKey: string,
  dropAgentStatus: (paneKey: string) => void,
  dismissRetainedAgent: (paneKey: string) => void
): void {
  dismissPiWebRow(paneKey)
  dropAgentStatus(paneKey)
  dismissRetainedAgent(paneKey)
}
