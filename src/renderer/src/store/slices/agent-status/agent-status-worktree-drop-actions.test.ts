import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import { PI_WEB_PANE_TAB_ID, piWebPaneKey } from '../../../../../shared/pi-web/pi-web-pane-key'
import { makePaneKey } from '../../../../../shared/stable-pane-id'
import { createTestStore, makeTab } from '../store-test-helpers'

const PI_WEB_KEY = piWebPaneKey('pi-session-1')
const TERMINAL_KEY = makePaneKey('tab-1', '22222222-2222-4222-8222-222222222222')

function doneEntry(paneKey: string, tabId: string, agentType: string): AgentStatusEntry {
  return {
    paneKey,
    state: 'done',
    prompt: 'finished',
    updatedAt: 1000,
    stateStartedAt: 1000,
    stateHistory: [],
    agentType,
    worktreeId: 'wt-1',
    tabId,
    interrupted: false
  }
}

function seededStore(): ReturnType<typeof createTestStore> {
  const store = createTestStore()
  store.setState({
    tabsByWorktree: { 'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })] },
    agentStatusByPaneKey: {
      [PI_WEB_KEY]: doneEntry(PI_WEB_KEY, PI_WEB_PANE_TAB_ID, 'pi-web'),
      [TERMINAL_KEY]: doneEntry(TERMINAL_KEY, 'tab-1', 'claude')
    },
    acknowledgedAgentsByPaneKey: { [PI_WEB_KEY]: 1500, [TERMINAL_KEY]: 1500 }
  })
  return store
}

describe('dropAgentStatusByWorktree', () => {
  it('sleep keeps pi-web rows', () => {
    const store = seededStore()

    store.getState().dropAgentStatusByWorktree('wt-1', { shutdownReason: 'manual-sleep' })

    const s = store.getState()
    expect(s.agentStatusByPaneKey[PI_WEB_KEY]?.state).toBe('done')
    expect(s.acknowledgedAgentsByPaneKey[PI_WEB_KEY]).toBe(1500)
    expect(s.agentStatusByPaneKey[TERMINAL_KEY]).toBeUndefined()
    expect(s.acknowledgedAgentsByPaneKey[TERMINAL_KEY]).toBeUndefined()
  })

  it('worktree removal drops pi-web rows', () => {
    const store = seededStore()

    store.getState().dropAgentStatusByWorktree('wt-1', { shutdownReason: 'remove-worktree' })

    const s = store.getState()
    expect(s.agentStatusByPaneKey[PI_WEB_KEY]).toBeUndefined()
    expect(s.acknowledgedAgentsByPaneKey[PI_WEB_KEY]).toBeUndefined()
    expect(s.agentStatusByPaneKey[TERMINAL_KEY]).toBeUndefined()
  })
})
