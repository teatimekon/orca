import { structuredAgentSessionPaneKey } from '../agent-session/view/structured-agent-session-projection'
import { PI_WEB_PANE_TAB_ID } from './pi-web-pane-tab-id'

export { PI_WEB_PANE_TAB_ID, isPiWebPaneKey } from './pi-web-pane-tab-id'

export function piWebPaneKey(sessionId: string): string {
  return structuredAgentSessionPaneKey(PI_WEB_PANE_TAB_ID, sessionId)
}
