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
