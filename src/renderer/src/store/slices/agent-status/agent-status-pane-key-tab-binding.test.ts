import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import { PI_WEB_PANE_TAB_ID, piWebPaneKey } from '../../../../../shared/pi-web/pi-web-pane-key'
import { makePaneKey } from '../../../../../shared/stable-pane-id'
import { createTestStore, makeTab } from '../store-test-helpers'
import { findCompletedOrphanPaneKeysForTabClose } from './agent-status-pane-key-tab-binding'

function doneEntry(paneKey: string, tabId: string): AgentStatusEntry {
  return {
    paneKey,
    state: 'done',
    prompt: 'finished',
    updatedAt: 1000,
    stateStartedAt: 1000,
    stateHistory: [],
    agentType: 'pi',
    worktreeId: 'wt-1',
    tabId,
    interrupted: false
  }
}

describe('findCompletedOrphanPaneKeysForTabClose', () => {
  it('tab close keeps done pi-web rows', () => {
    const piWebKey = piWebPaneKey('pi-session-1')
    const orphanKey = makePaneKey('tab-orphan', '22222222-2222-4222-8222-222222222222')
    const state = {
      ...createTestStore().getState(),
      tabsByWorktree: { 'wt-1': [makeTab({ id: 'tab-live', worktreeId: 'wt-1' })] },
      agentStatusByPaneKey: {
        [piWebKey]: { ...doneEntry(piWebKey, PI_WEB_PANE_TAB_ID), agentType: 'pi-web' },
        [orphanKey]: doneEntry(orphanKey, 'tab-orphan')
      }
    }

    // The ordinary completed orphan is still swept, so only the pi-web exception is under test.
    expect(findCompletedOrphanPaneKeysForTabClose(state, 'wt-1', 'tab-closed:')).toEqual([
      orphanKey
    ])
  })
})
