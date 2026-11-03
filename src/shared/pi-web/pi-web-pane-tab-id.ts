import { parsePaneKey } from '../stable-pane-id'

// Why: kept free of agent-status imports so freshness and tab-binding modules can import it without a cycle.
export const PI_WEB_PANE_TAB_ID = '7f1c2d4e-0000-4a1b-9c3d-5e6f70819aab'

export function isPiWebPaneKey(paneKey: string): boolean {
  return parsePaneKey(paneKey)?.tabId === PI_WEB_PANE_TAB_ID
}
