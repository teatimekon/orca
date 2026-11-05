import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { BrowserPage, BrowserWorkspace } from '../../../../shared/browser-workspace-types'
import type {
  PiWebAttentionEvent,
  PiWebBindRequest,
  PiWebRow,
  PiWebStatusDelta
} from '../../../../shared/pi-web/pi-web-status-types'
import { lookupPiWebRow } from '@/lib/pi-web/pi-web-row-registry'
import { createTestStore } from '../../store/slices/store-test-helpers'

type TestStore = ReturnType<typeof createTestStore>

const { storeHolder, dispatchPiWebAttention, openPiWebSession, acknowledgeViewedPiWebRow } =
  vi.hoisted(() => {
    const holder: { current: TestStore | null } = { current: null }
    return {
      storeHolder: holder,
      dispatchPiWebAttention: vi.fn(),
      openPiWebSession: vi.fn((_worktreeId: string, _sessionId: string) => Promise.resolve()),
      acknowledgeViewedPiWebRow: vi.fn()
    }
  })

vi.mock('../../store', () => ({
  useAppStore: {
    getState: () => storeHolder.current?.getState(),
    subscribe: (listener: Parameters<TestStore['subscribe']>[0]) =>
      storeHolder.current?.subscribe(listener) ?? (() => {})
  }
}))
vi.mock('@/lib/pi-web/pi-web-attention-dispatch', () => ({ dispatchPiWebAttention }))
vi.mock('@/lib/pi-web/open-pi-web', () => ({ openPiWebSession }))
vi.mock('@/lib/pi-web/pi-web-attention-surface', () => ({ acknowledgeViewedPiWebRow }))

import { registerPiWebIpcBridge } from './pi-web-ipc-bridge'

function makeRow(overrides: Partial<PiWebRow> = {}): PiWebRow {
  return {
    sessionId: 'session-1',
    worktreeId: 'wt-1',
    cwd: '/repo/wt-1',
    name: 'Refactor parser',
    state: 'working',
    stateStartedAt: 1000,
    updatedAt: 1000,
    ...overrides
  }
}

function liveRow(sessionId: string) {
  return storeHolder.current?.getState().agentStatusByPaneKey[piWebPaneKey(sessionId)]
}

// session-2 appears only from the snapshot, so its arrival proves the snapshot was applied.
async function snapshotApplied(): Promise<void> {
  await vi.waitFor(() => expect(liveRow('session-2')).toBeDefined())
}

describe('registerPiWebIpcBridge', () => {
  const calls: string[] = []
  let emitDelta: (delta: PiWebStatusDelta) => void = () => {}
  let emitOpen: (payload: { worktreeId: string; sessionId: string }) => void = () => {}
  let resolveSnapshot: (rows: PiWebRow[]) => void = () => {}
  let snapshot: Promise<PiWebRow[]> = Promise.resolve([])

  beforeEach(() => {
    vi.useFakeTimers()
    calls.length = 0
    dispatchPiWebAttention.mockClear()
    openPiWebSession.mockClear()
    storeHolder.current = createTestStore()
    snapshot = new Promise((resolve) => {
      resolveSnapshot = resolve
    })
    vi.stubGlobal('window', {
      api: {
        piWeb: {
          getSnapshot: () => {
            calls.push('getSnapshot')
            return snapshot
          },
          onStatusChanged: (callback: (delta: PiWebStatusDelta) => void) => {
            calls.push('onStatusChanged')
            emitDelta = callback
            return () => calls.push('unsubscribeStatus')
          },
          onOpenSession: (
            callback: (payload: { worktreeId: string; sessionId: string }) => void
          ) => {
            emitOpen = callback
            return () => calls.push('unsubscribeOpen')
          }
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('subscribes before the snapshot and keeps a delta row newer than the snapshot', async () => {
    registerPiWebIpcBridge([])
    expect(calls).toEqual(['onStatusChanged', 'getSnapshot'])

    emitDelta({ upserts: [makeRow({ state: 'done', updatedAt: 2000 })], removals: [], events: [] })
    resolveSnapshot([
      makeRow({ state: 'working', updatedAt: 1500 }),
      makeRow({ sessionId: 'session-2', updatedAt: 1200 })
    ])
    await snapshotApplied()

    expect(liveRow('session-1')).toMatchObject({ state: 'done', updatedAt: 2000 })
    expect(liveRow('session-2')).toMatchObject({ state: 'working', worktreeId: 'wt-1' })
  })

  it('does not let the snapshot resurrect a row a delta removed', async () => {
    registerPiWebIpcBridge([])

    emitDelta({ upserts: [], removals: ['session-1'], events: [] })
    resolveSnapshot([makeRow(), makeRow({ sessionId: 'session-2' })])
    await snapshotApplied()

    expect(liveRow('session-1')).toBeUndefined()
  })

  it('routes attention events and open requests to their seams and unsubscribes', async () => {
    const unsubs: (() => void)[] = []
    registerPiWebIpcBridge(unsubs)
    const event: PiWebAttentionEvent = {
      sessionId: 'session-1',
      worktreeId: 'wt-1',
      name: null,
      kind: 'completed'
    }

    emitDelta({ upserts: [makeRow({ state: 'done' })], removals: [], events: [event] })
    emitOpen({ worktreeId: 'wt-1', sessionId: 'session-1' })

    expect(dispatchPiWebAttention.mock.calls).toEqual([[event]])
    expect(openPiWebSession.mock.calls).toEqual([['wt-1', 'session-1']])
    unsubs.forEach((unsubscribe) => unsubscribe())
    expect(calls).toContain('unsubscribeStatus')
    expect(calls).toContain('unsubscribeOpen')
  })

  it('reads the viewed pi-web row on each store change, until unsubscribed', () => {
    const unsubs: (() => void)[] = []
    registerPiWebIpcBridge(unsubs)
    acknowledgeViewedPiWebRow.mockClear()

    emitDelta({ upserts: [makeRow({ state: 'done' })], removals: [], events: [] })
    expect(acknowledgeViewedPiWebRow).toHaveBeenCalledWith(storeHolder.current?.getState())

    unsubs.forEach((unsubscribe) => unsubscribe())
    acknowledgeViewedPiWebRow.mockClear()
    emitDelta({
      upserts: [makeRow({ state: 'working', updatedAt: 3000 })],
      removals: [],
      events: []
    })
    expect(acknowledgeViewedPiWebRow).not.toHaveBeenCalled()
  })

  it('forgets a registry row once worktree removal drops it, but not on sleep', () => {
    registerPiWebIpcBridge([])
    const paneKey = piWebPaneKey('session-registry-drop')
    emitDelta({
      upserts: [makeRow({ sessionId: 'session-registry-drop', state: 'done' })],
      removals: [],
      events: []
    })
    const drop = storeHolder.current?.getState().dropAgentStatusByWorktree

    drop?.('wt-1', { shutdownReason: 'manual-sleep' })
    expect(lookupPiWebRow(paneKey)).toEqual({
      sessionId: 'session-registry-drop',
      worktreeId: 'wt-1'
    })

    drop?.('wt-1', { shutdownReason: 'remove-worktree' })
    expect(liveRow('session-registry-drop')).toBeUndefined()
    expect(lookupPiWebRow(paneKey)).toBeNull()
  })

  it('binds the conversation a workspace tab shows on the server main reports', async () => {
    const binds: PiWebBindRequest[] = []
    let pushServerUrl: (url: string) => void = () => {}
    const api = window.api.piWeb
    vi.stubGlobal('window', {
      api: {
        piWeb: {
          ...api,
          bind: vi.fn(async (request: PiWebBindRequest) => {
            binds.push(request)
          }),
          getServerUrl: vi.fn(async () => null),
          onServerUrlChanged: (callback: (url: string) => void) => {
            pushServerUrl = callback
            return () => {}
          }
        }
      }
    })
    const showing = (url: string) => {
      const fields = { worktreeId: 'wt-1', url, title: 'pi-web', loading: false, createdAt: 0 }
      const nav = { faviconUrl: null, canGoBack: false, canGoForward: false, loadError: null }
      const tab: BrowserWorkspace = {
        ...fields,
        ...nav,
        id: 'bw',
        activePageId: 'p',
        pageIds: ['p']
      }
      const page: BrowserPage = { ...fields, ...nav, id: 'p', workspaceId: 'bw' }
      storeHolder.current?.setState({
        workspaceSessionReady: true,
        browserTabsByWorktree: { 'wt-1': [tab] },
        browserPagesByWorkspace: { bw: [page] }
      })
    }
    showing('http://127.0.0.1:30141/?session=restored&orcaEmbed=1')
    registerPiWebIpcBridge([])
    await vi.waitFor(() => expect(window.api.piWeb.getServerUrl).toHaveBeenCalled())

    pushServerUrl('http://127.0.0.1:30141')
    showing('http://127.0.0.1:30141/?session=opened')

    expect(binds).toEqual([
      { sessionId: 'restored', worktreeId: 'wt-1', restored: true },
      { sessionId: 'opened', worktreeId: 'wt-1', restored: false }
    ])
  })
})
