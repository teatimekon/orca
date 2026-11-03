import { structuredAgentSessionPaneKey } from '../agent-session/view/structured-agent-session-projection'
import { parsePaneKey } from '../stable-pane-id'

export const PI_WEB_PANE_TAB_ID = '7f1c2d4e-0000-4a1b-9c3d-5e6f70819aab'

export function piWebPaneKey(sessionId: string): string {
  return structuredAgentSessionPaneKey(PI_WEB_PANE_TAB_ID, sessionId)
}

export function isPiWebPaneKey(paneKey: string): boolean {
  return parsePaneKey(paneKey)?.tabId === PI_WEB_PANE_TAB_ID
}
