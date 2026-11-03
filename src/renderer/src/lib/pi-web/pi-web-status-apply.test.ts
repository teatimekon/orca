import { describe, expect, it, vi } from 'vitest'
import { PI_WEB_PANE_TAB_ID, piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { PiWebRow } from '../../../../shared/pi-web/pi-web-status-types'
import { lookupPiWebRow } from './pi-web-row-registry'
import { applyPiWebDelta } from './pi-web-status-apply'

function makeRow(overrides: Partial<PiWebRow> = {}): PiWebRow {
  return {
    sessionId: 'session-1',
    worktreeId: 'wt-1',
    cwd: '/repo/wt-1',
    name: 'Fix the flaky test',
    state: 'working',
    stateStartedAt: 1000,
    updatedAt: 2000,
    ...overrides
  }
}

function makeStore() {
  return { setAgentStatus: vi.fn(), removeAgentStatus: vi.fn() }
}

describe('applyPiWebDelta', () => {
  it('applies upsert as agent status with worktree routing', () => {
    const store = makeStore()

    applyPiWebDelta(
      {
        upserts: [makeRow(), makeRow({ sessionId: 'session-2', name: null, state: 'done' })],
        removals: [],
        events: []
      },
      store
    )

    expect(store.setAgentStatus.mock.calls).toEqual([
      [
        piWebPaneKey('session-1'),
        {
          state: 'working',
          prompt: 'Fix the flaky test',
          agentType: 'pi-web',
          interrupted: false,
          sessionBoundary: false
        },
        'Fix the flaky test',
        { updatedAt: 2000, stateStartedAt: 1000, allowOlderTimestamp: true },
        { tabId: PI_WEB_PANE_TAB_ID, worktreeId: 'wt-1' },
        { terminalResumeEligible: false }
      ],
      [
        piWebPaneKey('session-2'),
        {
          state: 'done',
          prompt: 'pi-web',
          agentType: 'pi-web',
          interrupted: false,
          sessionBoundary: false
        },
        'pi-web',
        { updatedAt: 2000, stateStartedAt: 1000, allowOlderTimestamp: true },
        { tabId: PI_WEB_PANE_TAB_ID, worktreeId: 'wt-1' },
        { terminalResumeEligible: false }
      ]
    ])
    expect(lookupPiWebRow(piWebPaneKey('session-1'))).toEqual({
      sessionId: 'session-1',
      worktreeId: 'wt-1'
    })
    expect(store.removeAgentStatus).not.toHaveBeenCalled()
  })

  it('removal forgets registry and removes status', () => {
    const store = makeStore()
    applyPiWebDelta(
      { upserts: [makeRow({ sessionId: 'session-gone' })], removals: [], events: [] },
      store
    )

    applyPiWebDelta({ upserts: [], removals: ['session-gone'], events: [] }, store)

    expect(lookupPiWebRow(piWebPaneKey('session-gone'))).toBeNull()
    expect(store.removeAgentStatus.mock.calls).toEqual([[piWebPaneKey('session-gone')]])
  })
})
