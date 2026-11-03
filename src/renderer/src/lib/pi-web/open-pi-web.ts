import { toast } from 'sonner'
import { webviewRegistry } from '@/components/browser-pane/host-guest/webview-registry'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { isPiWebLocalWorkspace } from './pi-web-local-workspace'
import type { BrowserPage, BrowserWorkspace } from '../../../../shared/browser-workspace-types'
import type { Tab } from '../../../../shared/tab-types'
import { translate } from '@/i18n/i18n'

export type PiWebBrowserTarget = { workspaceId: string; pageId: string }

type PiWebPageCandidate = PiWebBrowserTarget & {
  sessionId: string | null
  activeAt: number
  isActivePage: boolean
  createdAt: number
}

const PI_WEB_TAB_TITLE = 'pi-web'

function piWebUrl(baseUrl: string, param: 'session' | 'cwd', value: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/?${param}=${encodeURIComponent(value)}&orcaEmbed=1`
}

export function buildPiWebSessionUrl(baseUrl: string, sessionId: string): string {
  return piWebUrl(baseUrl, 'session', sessionId)
}

export function buildPiWebNewUrl(baseUrl: string, cwd: string): string {
  return piWebUrl(baseUrl, 'cwd', cwd)
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function newestFirst(a: PiWebPageCandidate, b: PiWebPageCandidate): number {
  return (
    b.activeAt - a.activeAt ||
    Number(b.isActivePage) - Number(a.isActivePage) ||
    b.createdAt - a.createdAt
  )
}

/** The pi-web page (URL origin equals `origin`) to show `sessionId` in: one already on it, else the most recently active. */
export function choosePiWebBrowserTarget(input: {
  tabs: readonly BrowserWorkspace[]
  pagesByWorkspace: Readonly<Record<string, readonly BrowserPage[] | undefined>>
  origin: string
  sessionId: string | null
  /** Unified-tab focus stamps by browser workspace id; a never-focused tab counts from its creation. */
  lastFocusedAtByWorkspaceId?: Readonly<Record<string, number | undefined>>
}): PiWebBrowserTarget | null {
  const candidates: PiWebPageCandidate[] = []
  for (const tab of input.tabs) {
    const activeAt = input.lastFocusedAtByWorkspaceId?.[tab.id] ?? tab.createdAt
    for (const page of input.pagesByWorkspace[tab.id] ?? []) {
      const url = parseUrl(page.url)
      if (url?.origin === input.origin) {
        candidates.push({
          workspaceId: tab.id,
          pageId: page.id,
          sessionId: url.searchParams.get('session'),
          activeAt,
          isActivePage: page.id === tab.activePageId,
          createdAt: page.createdAt
        })
      }
    }
  }
  candidates.sort(newestFirst)
  const chosen =
    candidates.find(
      (candidate) => input.sessionId !== null && candidate.sessionId === input.sessionId
    ) ?? candidates[0]
  return chosen ? { workspaceId: chosen.workspaceId, pageId: chosen.pageId } : null
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function browserTabFocusStamps(tabs: readonly Tab[] | undefined): Record<string, number> {
  const stamps: Record<string, number> = {}
  for (const tab of tabs ?? []) {
    if (tab.contentType === 'browser' && tab.lastFocusedAt !== undefined) {
      stamps[tab.entityId] = tab.lastFocusedAt
    }
  }
  return stamps
}

function pageSessionId(
  pagesByWorkspace: AppState['browserPagesByWorkspace'],
  target: PiWebBrowserTarget
): string | null {
  const page = pagesByWorkspace[target.workspaceId]?.find((entry) => entry.id === target.pageId)
  return page ? (parseUrl(page.url)?.searchParams.get('session') ?? null) : null
}

function navigatePiWebPage(pageId: string, url: string): void {
  const webview = webviewRegistry.get(pageId)
  if (webview) {
    try {
      // Why: loadURL rejects on any failed navigation; did-fail-load owns error reporting.
      void webview.loadURL(url).catch(() => {})
      return
    } catch {
      // A guest that has not attached yet throws; it loads the stored URL once it does.
    }
  }
  // Why not deferBrowserPageNavigation: only client-hosted/remote panes replay it; a local page loads its stored URL on mount.
  useAppStore.getState().setBrowserPageUrl(pageId, url)
}

// Same sequence as ui:focusEditorTab's browser branch (terminal-ui-routing-ipc-bridge.ts); the workspace is already revealed.
function activatePiWebPage(worktreeId: string, target: PiWebBrowserTarget): void {
  const store = useAppStore.getState()
  const tab = store.unifiedTabsByWorktree[worktreeId]?.find(
    (item) => item.contentType === 'browser' && item.entityId === target.workspaceId
  )
  if (tab) {
    store.focusGroup(worktreeId, tab.groupId)
    store.activateTab(tab.id)
  }
  store.setActiveBrowserPage(target.workspaceId, target.pageId)
  store.setActiveBrowserTab(target.workspaceId)
  store.setActiveTabType('browser', worktreeId)
}

function createPiWebTab(worktreeId: string, url: string): void {
  useAppStore.getState().createBrowserTab(worktreeId, url, {
    activate: true,
    title: PI_WEB_TAB_TITLE,
    // The pi-web server runs on this desktop, so no paired runtime may adopt or stream the page.
    browserRuntimeEnvironmentId: null
  })
}

async function openPiWeb(worktreeId: string, open: (baseUrl: string) => void): Promise<void> {
  try {
    if (!isPiWebLocalWorkspace(useAppStore.getState(), worktreeId)) {
      toast.error(translate('piWeb.open.localOnly', 'pi-web: only local workspaces are supported'))
      return
    }
    const server = await window.api.piWeb.ensureServer()
    if (!server.ok) {
      toast.error(translate('piWeb.open.failed', 'pi-web: {{reason}}', { reason: server.reason }))
      return
    }
    // Why the workspace dispatcher: folder ids (notification clicks) get its path guards; the tab is the surface, so no shell.
    if (activateAndRevealWorkspace(worktreeId, { providesInitialSurface: true }) === false) {
      return
    }
    open(server.url)
  } catch (error) {
    toast.error(
      translate('piWeb.open.failed', 'pi-web: {{reason}}', { reason: errorReason(error) })
    )
  }
}

/** Shows a pi-web conversation in its workspace, reusing a pi-web tab there; never rejects. */
export function openPiWebSession(worktreeId: string, sessionId: string): Promise<void> {
  return openPiWeb(worktreeId, (baseUrl) => {
    const url = buildPiWebSessionUrl(baseUrl, sessionId)
    const state = useAppStore.getState()
    const target = choosePiWebBrowserTarget({
      tabs: state.browserTabsByWorktree[worktreeId] ?? [],
      pagesByWorkspace: state.browserPagesByWorkspace,
      origin: new URL(baseUrl).origin,
      sessionId,
      lastFocusedAtByWorkspaceId: browserTabFocusStamps(state.unifiedTabsByWorktree[worktreeId])
    })
    if (!target) {
      createPiWebTab(worktreeId, url)
      return
    }
    if (pageSessionId(state.browserPagesByWorkspace, target) !== sessionId) {
      navigatePiWebPage(target.pageId, url)
    }
    activatePiWebPage(worktreeId, target)
  })
}

/** Opens pi-web's new-conversation composer for the workspace directory in a new tab; never rejects. */
export function openPiWebNew(worktreeId: string): Promise<void> {
  return openPiWeb(worktreeId, (baseUrl) => {
    const cwd = useAppStore.getState().getKnownWorktreeById(worktreeId)?.path
    if (!cwd) {
      throw new Error('workspace path is unknown')
    }
    createPiWebTab(worktreeId, buildPiWebNewUrl(baseUrl, cwd))
  })
}
