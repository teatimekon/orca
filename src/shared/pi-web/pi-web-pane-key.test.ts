import { describe, expect, it } from 'vitest'
import { structuredAgentSessionPaneKey } from '../agent-session/view/structured-agent-session-projection'
import { parsePaneKey } from '../stable-pane-id'
import { isPiWebPaneKey, piWebPaneKey } from './pi-web-pane-key'

describe('pi-web pane key', () => {
  it('pane key parses and is recognised', () => {
    const key = piWebPaneKey('abc')
    expect(parsePaneKey(key)).not.toBeNull()
    expect(isPiWebPaneKey(key)).toBe(true)
    expect(isPiWebPaneKey(structuredAgentSessionPaneKey('other-tab', 'abc'))).toBe(false)
  })
})
