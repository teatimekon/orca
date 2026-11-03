// Use the real store so the acknowledgement lands where the sidebar's bold reads it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setPresenceGated } from '@/hooks/agent-auto-ack-presence'
import { piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { BrowserPage, BrowserWorkspace } from '../../../../shared/browser-workspace-types'
import { createTestStore, makeWorktree, TEST_REPO } from '@/store/slices/store-test-helpers'
import { forgetPiWebRow } from './pi-web-row-registry'
import { applyPiWebDelta } from './pi-web-status-apply'
import { acknowledgeViewedPiWebRow } from './pi-web-attention-surface'

const WORKSPACE = 'repo1::/tmp/wt'
const SESSION = 'session-1'
const PANE_KEY = piWebPaneKey(SESSION)
const store = createTestStore()

function pageOn(url: string): { tab: BrowserWorkspace; page: BrowserPage } {
  const base = {
    worktreeId: WORKSPACE,
    url,
    title: 'pi-web',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 0
  }
  return {
    tab: { ...base, id: 'bw1', activePageId: 'p1', pageIds: ['p1'] },
    page: { ...base, id: 'p1', workspaceId: 'bw1' }
  }
}

function seed(url: string, activeTabType: 'browser' | 'terminal' = 'browser'): void {
  const { tab, page } = pageOn(url)
  store.setState({
    repos: [TEST_REPO],
    worktreesByRepo: { repo1: [makeWorktree({ id: WORKSPACE, repoId: 'repo1' })] },
    activeView: 'terminal',
    activeWorktreeId: WORKSPACE,
    activeTabTypeByWorktree: { [WORKSPACE]: activeTabType },
    activeBrowserTabIdByWorktree: { [WORKSPACE]: 'bw1' },
    browserTabsByWorktree: { [WORKSPACE]: [tab] },
    browserPagesByWorkspace: { bw1: [page] },
    acknowledgedAgentsByPaneKey: {},
    manuallyUnreadTurnsByPaneKey: {}
  })
  applyPiWebDelta(
    {
      upserts: [
        {
          sessionId: SESSION,
          worktreeId: WORKSPACE,
          cwd: '/tmp/wt',
          name: 'Fix the flaky test',
          state: 'done',
          stateStartedAt: 5000,
          updatedAt: 5000
        }
      ],
      removals: [],
      events: []
    },
    store.getState()
  )
}

const acknowledged = (): number | undefined =>
  store.getState().acknowledgedAgentsByPaneKey[PANE_KEY]

describe('acknowledgeViewedPiWebRow', () => {
  beforeEach(() => {
    setPresenceGated(false)
    vi.stubGlobal('window', { api: { notifications: { dismiss: vi.fn(async () => {}) } } })
  })
  afterEach(() => {
    setPresenceGated(true)
    forgetPiWebRow(SESSION)
    store.getState().removeAgentStatus(PANE_KEY)
    vi.unstubAllGlobals()
  })

  it('the active pi-web page showing the session counts as viewed', () => {
    seed(`http://127.0.0.1:30142/?session=${SESSION}&orcaEmbed=1`)
    acknowledgeViewedPiWebRow(store.getState())
    expect(acknowledged()).toBeGreaterThanOrEqual(5000)
  })

  it('another conversation, a terminal in front, or explicit unread leaves the row unread', () => {
    seed('http://127.0.0.1:30142/?session=other&orcaEmbed=1')
    acknowledgeViewedPiWebRow(store.getState())
    expect(acknowledged()).toBeUndefined()

    seed(`http://127.0.0.1:30142/?session=${SESSION}`, 'terminal')
    acknowledgeViewedPiWebRow(store.getState())
    expect(acknowledged()).toBeUndefined()

    seed(`http://127.0.0.1:30142/?session=${SESSION}`)
    const turn = store.getState().agentStatusByPaneKey[PANE_KEY]?.stateStartedAt
    store.setState({ manuallyUnreadTurnsByPaneKey: { [PANE_KEY]: turn ?? 0 } })
    acknowledgeViewedPiWebRow(store.getState())
    expect(acknowledged()).toBeUndefined()
  })

  it('an away user (presence unconfirmed) is not reading it', () => {
    setPresenceGated(true)
    seed(`http://127.0.0.1:30142/?session=${SESSION}`)
    acknowledgeViewedPiWebRow(store.getState())
    expect(acknowledged()).toBeUndefined()
  })
})
