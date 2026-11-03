import { describe, expect, it } from 'vitest'
import { isAgentStatusFresh, isFreshNonDoneAgentStatus } from './agent-status-freshness'
import { piWebPaneKey } from './pi-web/pi-web-pane-key'
import { makePaneKey } from './stable-pane-id'

const NOW = 10 * 60 * 60 * 1000
const TWO_HOURS_AGO = NOW - 2 * 60 * 60 * 1000

describe('agent status freshness', () => {
  it('pi-web rows never go stale', () => {
    const piWeb = {
      paneKey: piWebPaneKey('pi-session-1'),
      state: 'working',
      updatedAt: TWO_HOURS_AGO
    } as const
    const terminal = {
      paneKey: makePaneKey('tab-1', '22222222-2222-4222-8222-222222222222'),
      state: 'working',
      updatedAt: TWO_HOURS_AGO
    } as const

    expect(isAgentStatusFresh(piWeb, NOW)).toBe(true)
    expect(isFreshNonDoneAgentStatus(piWeb, NOW)).toBe(true)
    // Control: the same age still decays an ordinary hook row.
    expect(isAgentStatusFresh(terminal, NOW)).toBe(false)
  })
})
