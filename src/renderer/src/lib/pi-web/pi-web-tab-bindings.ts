import type { AppState } from '@/store/types'
import type { PiWebBindRequest } from '../../../../shared/pi-web/pi-web-status-types'
import { piWebPageSessionId } from './pi-web-url'

export type PiWebTabBindingState = Pick<
  AppState,
  'browserTabsByWorktree' | 'browserPagesByWorkspace' | 'workspaceSessionReady'
>

type PiWebTabSession = { sessionId: string; worktreeId: string }

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function collectPiWebTabSessions(
  state: PiWebTabBindingState,
  origin: string
): Map<string, PiWebTabSession> {
  const sessions = new Map<string, PiWebTabSession>()
  for (const [worktreeId, tabs] of Object.entries(state.browserTabsByWorktree)) {
    for (const tab of tabs) {
      for (const page of state.browserPagesByWorkspace[tab.id] ?? []) {
        const sessionId = piWebPageSessionId(page.url, origin)
        if (sessionId) {
          sessions.set(page.id, { sessionId, worktreeId })
        }
      }
    }
  }
  return sessions
}

export type PiWebTabBindingWatcher = {
  /** Call on every store change; cheap unless browser tabs or pages changed. */
  sync(state: PiWebTabBindingState): void
  setServerUrl(url: string, state: PiWebTabBindingState): void
}

/**
 * Binds each pi-web conversation to the workspace whose browser tab shows it. Pages already
 * open when the workspace session is restored (or the server becomes known) bind as `restored`,
 * which keeps an existing binding; a page that turns to a conversation later moves it to its tab.
 */
export function createPiWebTabBindingWatcher(
  bind: (request: PiWebBindRequest) => void
): PiWebTabBindingWatcher {
  let origin: string | null = null
  // What each page showed at the last look; null until the pages present at start are bound.
  let shown: Map<string, PiWebTabSession> | null = null
  let lastTabs: PiWebTabBindingState['browserTabsByWorktree'] | null = null
  let lastPages: PiWebTabBindingState['browserPagesByWorkspace'] | null = null

  const sync = (state: PiWebTabBindingState): void => {
    if (origin === null || !state.workspaceSessionReady) {
      return
    }
    if (
      shown !== null &&
      state.browserTabsByWorktree === lastTabs &&
      state.browserPagesByWorkspace === lastPages
    ) {
      return
    }
    lastTabs = state.browserTabsByWorktree
    lastPages = state.browserPagesByWorkspace
    const restored = shown === null
    const current = collectPiWebTabSessions(state, origin)
    for (const [pageId, { sessionId, worktreeId }] of current) {
      const before = shown?.get(pageId)
      if (before?.sessionId !== sessionId || before.worktreeId !== worktreeId) {
        bind({ sessionId, worktreeId, restored })
      }
    }
    shown = current
  }

  return {
    sync,
    setServerUrl: (url, state) => {
      const next = originOf(url)
      if (next === origin) {
        return
      }
      origin = next
      shown = null
      sync(state)
    }
  }
}
