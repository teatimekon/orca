import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserPage, BrowserWorkspace } from '../../../../shared/browser-workspace-types'
import type { PiWebEnsureResult } from '../../../../shared/pi-web/pi-web-status-types'
import type { Tab } from '../../../../shared/tab-types'
import { piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'

const { state, activateAndRevealWorkspace, toastError, webviewRegistry, isLocal } = vi.hoisted(
  () => {
    const fakeState: Record<string, unknown> = {}
    return {
      state: fakeState,
      isLocal: vi.fn((_state: unknown, _worktreeId: string) => true),
      activateAndRevealWorkspace: vi.fn((_workspaceId: string, _opts?: unknown): unknown => ({
        primaryTabId: null
      })),
      toastError: vi.fn(),
      webviewRegistry: new Map<string, { loadURL: (url: string) => Promise<void> }>()
    }
  }
)

vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorkspace }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('@/components/browser-pane/host-guest/webview-registry', () => ({ webviewRegistry }))
vi.mock('./pi-web-local-workspace', () => ({ isPiWebLocalWorkspace: isLocal }))

const {
  buildPiWebNewUrl,
  buildPiWebSessionUrl,
  choosePiWebBrowserTarget,
  openPiWebNew,
  openPiWebSession
} = await import('./open-pi-web')

const BASE = 'http://127.0.0.1:30141'
const ORIGIN = 'http://127.0.0.1:30141'
const WT = 'repo1::/work/app'

function workspace(id: string, over: Partial<BrowserWorkspace> = {}): BrowserWorkspace {
  return {
    id,
    worktreeId: WT,
    url: '',
    title: '',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 0,
    activePageId: `${id}-p`,
    pageIds: [`${id}-p`],
    ...over
  }
}

function page(workspaceId: string, url: string, over: Partial<BrowserPage> = {}): BrowserPage {
  return {
    id: `${workspaceId}-p`,
    workspaceId,
    worktreeId: WT,
    url,
    title: '',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 0,
    ...over
  }
}

describe('pi-web urls', () => {
  it('session url encodes id and sets orcaEmbed', () => {
    expect(buildPiWebSessionUrl(BASE, 'a b/c')).toBe(`${BASE}/?session=a%20b%2Fc&orcaEmbed=1`)
    expect(buildPiWebSessionUrl(`${BASE}/`, 's1')).toBe(`${BASE}/?session=s1&orcaEmbed=1`)
  })

  it('new url encodes cwd', () => {
    expect(buildPiWebNewUrl(BASE, '/work/my app')).toBe(
      `${BASE}/?cwd=%2Fwork%2Fmy%20app&orcaEmbed=1`
    )
  })
})

describe('choosePiWebBrowserTarget', () => {
  it('prefers page already showing the session', () => {
    const tabs = [workspace('a'), workspace('b')]
    const pagesByWorkspace = {
      a: [page('a', `${BASE}/?session=other`)],
      b: [page('b', `${BASE}/?session=s1&orcaEmbed=1`)]
    }
    expect(
      choosePiWebBrowserTarget({ tabs, pagesByWorkspace, origin: ORIGIN, sessionId: 's1' })
    ).toEqual({ workspaceId: 'b', pageId: 'b-p' })
  })

  it('falls back to any pi-web page in worktree', () => {
    const tabs = [workspace('a')]
    const pagesByWorkspace = { a: [page('a', `${BASE}/?session=other`)] }
    expect(
      choosePiWebBrowserTarget({ tabs, pagesByWorkspace, origin: ORIGIN, sessionId: 's1' })
    ).toEqual({ workspaceId: 'a', pageId: 'a-p' })
  })

  it('falls back to the most recently focused pi-web tab', () => {
    const tabs = [workspace('old', { createdAt: 1 }), workspace('new', { createdAt: 2 })]
    const pagesByWorkspace = {
      old: [page('old', `${BASE}/?session=x`)],
      new: [page('new', `${BASE}/?session=y`)]
    }
    expect(
      choosePiWebBrowserTarget({ tabs, pagesByWorkspace, origin: ORIGIN, sessionId: 's1' })
    ).toEqual({ workspaceId: 'new', pageId: 'new-p' })
    expect(
      choosePiWebBrowserTarget({
        tabs,
        pagesByWorkspace,
        origin: ORIGIN,
        sessionId: 's1',
        lastFocusedAtByWorkspaceId: { old: 10, new: 5 }
      })
    ).toEqual({ workspaceId: 'old', pageId: 'old-p' })
  })

  it('ignores pages of other origins', () => {
    const tabs = [workspace('a'), workspace('b')]
    const pagesByWorkspace = {
      a: [page('a', 'http://127.0.0.1:3000/?session=s1')],
      b: [page('b', 'https://example.com/?session=s1')]
    }
    expect(
      choosePiWebBrowserTarget({ tabs, pagesByWorkspace, origin: ORIGIN, sessionId: 's1' })
    ).toBeNull()
  })

  it('returns null when no pi-web page', () => {
    expect(
      choosePiWebBrowserTarget({ tabs: [], pagesByWorkspace: {}, origin: ORIGIN, sessionId: null })
    ).toBeNull()
    const tabs = [workspace('a')]
    expect(
      choosePiWebBrowserTarget({
        tabs,
        pagesByWorkspace: { a: [page('a', 'about:blank')] },
        origin: ORIGIN,
        sessionId: null
      })
    ).toBeNull()
  })
})

describe('opening pi-web', () => {
  let ensureResult: PiWebEnsureResult
  const actions = {
    createBrowserTab: vi.fn(),
    setBrowserPageUrl: vi.fn(),
    focusGroup: vi.fn(),
    activateTab: vi.fn(),
    setActiveBrowserPage: vi.fn(),
    setActiveBrowserTab: vi.fn(),
    setActiveTabType: vi.fn(),
    acknowledgeAgents: vi.fn()
  }

  function seed(pages: BrowserPage[], unifiedTabs: Partial<Tab>[] = []): void {
    for (const key of Object.keys(state)) {
      delete state[key]
    }
    Object.assign(state, actions, {
      browserTabsByWorktree: { [WT]: pages.map((p) => workspace(p.workspaceId)) },
      browserPagesByWorkspace: Object.fromEntries(pages.map((p) => [p.workspaceId, [p]])),
      unifiedTabsByWorktree: { [WT]: unifiedTabs },
      getKnownWorktreeById: (id: string) => (id === WT ? { id, path: '/work/app' } : undefined)
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    isLocal.mockReturnValue(true)
    webviewRegistry.clear()
    ensureResult = { ok: true, url: BASE }
    vi.stubGlobal('window', {
      api: { piWeb: { ensureServer: vi.fn(async () => ensureResult) } }
    })
    seed([])
  })

  it('shows the ensureServer failure as a pi-web toast and opens nothing', async () => {
    ensureResult = { ok: false, reason: 'launch command failed' }
    await openPiWebSession(WT, 's1')
    expect(toastError).toHaveBeenCalledWith('pi-web: launch command failed')

    vi.stubGlobal('window', {
      api: {
        piWeb: {
          ensureServer: vi.fn(async () => {
            throw new Error('ipc gone')
          })
        }
      }
    })
    await expect(openPiWebNew(WT)).resolves.toBeUndefined()
    expect(toastError).toHaveBeenCalledWith('pi-web: ipc gone')
    expect(activateAndRevealWorkspace).not.toHaveBeenCalled()
    expect(actions.createBrowserTab).not.toHaveBeenCalled()
  })

  it('reveals the workspace, folder ids included, and opens a tab when none is pi-web', async () => {
    const folder = 'folder:f1'
    await openPiWebSession(folder, 's1')
    expect(activateAndRevealWorkspace).toHaveBeenCalledWith(folder, {
      providesInitialSurface: true
    })
    expect(actions.createBrowserTab).toHaveBeenCalledWith(
      folder,
      `${BASE}/?session=s1&orcaEmbed=1`,
      { activate: true, title: 'pi-web', browserRuntimeEnvironmentId: null }
    )
  })

  it('navigates a pi-web page on another session and activates its tab', async () => {
    seed(
      [page('a', `${BASE}/?session=other`)],
      [{ id: 'u1', contentType: 'browser', entityId: 'a', groupId: 'g1' }]
    )
    await openPiWebSession(WT, 's1')
    expect(actions.setBrowserPageUrl).toHaveBeenCalledWith('a-p', `${BASE}/?session=s1&orcaEmbed=1`)
    expect(actions.createBrowserTab).not.toHaveBeenCalled()
    expect(actions.focusGroup).toHaveBeenCalledWith(WT, 'g1')
    expect(actions.activateTab).toHaveBeenCalledWith('u1')
    expect(actions.setActiveBrowserPage).toHaveBeenCalledWith('a', 'a-p')
    expect(actions.setActiveBrowserTab).toHaveBeenCalledWith('a')
    expect(actions.setActiveTabType).toHaveBeenCalledWith('browser', WT)
  })

  it('loads the url into a mounted guest, and leaves a page on the session alone', async () => {
    const loadURL = vi.fn(async () => {})
    webviewRegistry.set('a-p', { loadURL })
    seed([page('a', `${BASE}/?session=other`)])
    await openPiWebSession(WT, 's1')
    expect(loadURL).toHaveBeenCalledWith(`${BASE}/?session=s1&orcaEmbed=1`)
    expect(actions.setBrowserPageUrl).not.toHaveBeenCalled()

    loadURL.mockClear()
    seed([page('a', `${BASE}/?session=s1`)])
    await openPiWebSession(WT, 's1')
    expect(loadURL).not.toHaveBeenCalled()
    expect(actions.setBrowserPageUrl).not.toHaveBeenCalled()
    expect(actions.setActiveBrowserTab).toHaveBeenCalledWith('a')
  })

  it('created tab pins local runtime', async () => {
    seed([page('a', `${BASE}/?session=other`)])
    await openPiWebNew(WT)
    expect(actions.createBrowserTab).toHaveBeenCalledWith(
      WT,
      `${BASE}/?cwd=%2Fwork%2Fapp&orcaEmbed=1`,
      { activate: true, title: 'pi-web', browserRuntimeEnvironmentId: null }
    )
  })

  it('openPiWebSession refuses remote worktree', async () => {
    isLocal.mockReturnValue(false)
    await openPiWebSession(WT, 's1')
    expect(isLocal).toHaveBeenCalledWith(state, WT)
    expect(toastError).toHaveBeenCalledWith('pi-web: only local workspaces are supported')
    expect(window.api.piWeb.ensureServer).not.toHaveBeenCalled()
    expect(activateAndRevealWorkspace).not.toHaveBeenCalled()
    expect(actions.createBrowserTab).not.toHaveBeenCalled()
  })

  it('opening a pi-web session acknowledges its row', async () => {
    await openPiWebSession(WT, 's1')
    expect(actions.acknowledgeAgents).toHaveBeenCalledWith([piWebPaneKey('s1')])

    // Reusing a pi-web page that already shows it acknowledges it too.
    actions.acknowledgeAgents.mockClear()
    seed([page('a', `${BASE}/?session=s1`)])
    await openPiWebSession(WT, 's1')
    expect(actions.acknowledgeAgents).toHaveBeenCalledWith([piWebPaneKey('s1')])
  })

  it('a session that does not open stays unacknowledged', async () => {
    ensureResult = { ok: false, reason: 'launch command failed' }
    await openPiWebSession(WT, 's1')
    isLocal.mockReturnValue(false)
    await openPiWebSession(WT, 's1')
    isLocal.mockReturnValue(true)
    ensureResult = { ok: true, url: BASE }
    actions.createBrowserTab.mockImplementationOnce(() => {
      throw new Error('browser unavailable')
    })
    await openPiWebSession(WT, 's1')
    // The new-conversation composer has no row to acknowledge.
    await openPiWebNew(WT)
    expect(actions.acknowledgeAgents).not.toHaveBeenCalled()
  })

  it('reports a tab that cannot be created instead of rejecting', async () => {
    actions.createBrowserTab.mockImplementationOnce(() => {
      throw new Error('browser unavailable')
    })
    await expect(openPiWebSession(WT, 's1')).resolves.toBeUndefined()
    expect(toastError).toHaveBeenCalledWith('pi-web: browser unavailable')
  })
})
