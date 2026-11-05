import { describe, expect, it } from 'vitest'
import type { BrowserPage, BrowserWorkspace } from '../../../../shared/browser-workspace-types'
import type { PiWebBindRequest } from '../../../../shared/pi-web/pi-web-status-types'
import { createPiWebTabBindingWatcher, type PiWebTabBindingState } from './pi-web-tab-bindings'

const PI = 'http://127.0.0.1:30141'
const WT = 'repo1::/work/app'
const NOTES = 'folder:notes'

type PageSpec = { worktreeId: string; tabId: string; pageId: string; url: string }

function base(worktreeId: string, url: string) {
  return {
    worktreeId,
    url,
    title: 'pi-web',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 0
  }
}

function stateOf(specs: PageSpec[], workspaceSessionReady = true): PiWebTabBindingState {
  const browserTabsByWorktree: Record<string, BrowserWorkspace[]> = {}
  const browserPagesByWorkspace: Record<string, BrowserPage[]> = {}
  for (const spec of specs) {
    const tabPages = (browserPagesByWorkspace[spec.tabId] ??= [])
    tabPages.push({ ...base(spec.worktreeId, spec.url), id: spec.pageId, workspaceId: spec.tabId })
    const tabs = (browserTabsByWorktree[spec.worktreeId] ??= [])
    if (!tabs.some((tab) => tab.id === spec.tabId)) {
      tabs.push({
        ...base(spec.worktreeId, spec.url),
        id: spec.tabId,
        activePageId: spec.pageId,
        pageIds: [spec.pageId]
      })
    }
  }
  return { browserTabsByWorktree, browserPagesByWorkspace, workspaceSessionReady }
}

const page = (url: string, over: Partial<PageSpec> = {}): PageSpec => ({
  worktreeId: WT,
  tabId: 'bw1',
  pageId: 'p1',
  url,
  ...over
})

function watch() {
  const binds: PiWebBindRequest[] = []
  const watcher = createPiWebTabBindingWatcher((request) => binds.push(request))
  return { binds, watcher }
}

describe('pi-web tab bindings', () => {
  it('binds conversations shown on the pi-web server, not other hosts or the composer', () => {
    const { binds, watcher } = watch()
    watcher.setServerUrl(
      `${PI}/`,
      stateOf([
        page(`${PI}/?session=a&orcaEmbed=1`),
        page('http://127.0.0.1:30999/?session=b&orcaEmbed=1', { pageId: 'p2' }),
        page('https://example.com/?session=c', { tabId: 'bw2', pageId: 'p3' }),
        page(`${PI}/?cwd=%2Fwork%2Fapp&orcaEmbed=1`, { tabId: 'bw3', pageId: 'p4' }),
        page(`${PI}/?cwd=%2Fwork%2Fapp&session=d`, { tabId: 'bw3', pageId: 'p5' })
      ])
    )

    expect(binds).toEqual([{ sessionId: 'a', worktreeId: WT, restored: true }])
  })

  it('replays the restored pages once the workspace session and the server are known', () => {
    const { binds, watcher } = watch()
    const pages = [
      page(`${PI}/?session=a&orcaEmbed=1`),
      page(`${PI}/?session=b`, { worktreeId: NOTES, tabId: 'bw2', pageId: 'p2' })
    ]

    watcher.sync(stateOf(pages))
    watcher.setServerUrl(PI, stateOf(pages, false))
    expect(binds).toEqual([])

    const ready = stateOf(pages)
    watcher.sync(ready)
    watcher.sync(ready)
    expect(binds).toEqual([
      { sessionId: 'a', worktreeId: WT, restored: true },
      { sessionId: 'b', worktreeId: NOTES, restored: true }
    ])

    // pi-web restarted on another port: the pages left on it bind nothing new.
    binds.length = 0
    watcher.setServerUrl('http://127.0.0.1:30142', ready)
    expect(binds).toEqual([])
  })

  it('a page that turns to a conversation later binds it to its workspace, once', () => {
    const { binds, watcher } = watch()
    watcher.setServerUrl(PI, stateOf([page(`${PI}/?cwd=%2Fwork%2Fapp&orcaEmbed=1`)]))
    expect(binds).toEqual([])

    // After the first message pi-web replaces the URL and drops orcaEmbed.
    watcher.sync(stateOf([page(`${PI}/?session=new`)]))
    watcher.sync(stateOf([page(`${PI}/?session=new`)]))
    watcher.sync(stateOf([page(`${PI}/?session=old&orcaEmbed=1`)]))
    watcher.sync(
      stateOf([
        page(`${PI}/?session=old&orcaEmbed=1`),
        page(`${PI}/?session=old&orcaEmbed=1`, { worktreeId: NOTES, tabId: 'bw2', pageId: 'p2' })
      ])
    )

    expect(binds).toEqual([
      { sessionId: 'new', worktreeId: WT, restored: false },
      { sessionId: 'old', worktreeId: WT, restored: false },
      { sessionId: 'old', worktreeId: NOTES, restored: false }
    ])
  })
})
