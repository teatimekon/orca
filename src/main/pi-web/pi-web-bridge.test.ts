import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  DEFAULT_PI_WEB_SETTINGS,
  PI_WEB_IPC,
  type PiWebSessionState,
  type PiWebSettings
} from '../../shared/pi-web/pi-web-status-types'
import { PiWebBridge, type PiWebBridgeDeps } from './pi-web-bridge'
import type { PiWebLaunchResult } from './pi-web-launcher'
import type { PiWebStreamHandlers } from './pi-web-status-stream'
import type { PiWebWorktreePathEntry } from './pi-web-worktree-index'

const URL = 'http://127.0.0.1:30142'
const WT: PiWebWorktreePathEntry = { worktreeId: 'repo::/w/proj', path: '/w/proj' }
const BASE_CONFIG: PiWebSettings = {
  ...DEFAULT_PI_WEB_SETTINGS,
  serverUrl: URL,
  agentDir: '/agent'
}

type FakeStream = { url: string; handlers: PiWebStreamHandlers; closed: boolean }

const dirs: string[] = []
const bridges: PiWebBridge[] = []
let warn: MockInstance

function session(over: Partial<PiWebSessionState> = {}): PiWebSessionState {
  return {
    id: 's1',
    cwd: '/w/proj/src',
    name: 'chat',
    parentSessionId: null,
    status: 'working',
    aborted: false,
    lastRunEndedAt: null,
    lastRunAborted: false,
    ...over
  }
}

function rowsFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pi-web-bridge-'))
  dirs.push(dir)
  return join(dir, 'pi-web', 'rows.json')
}

function createHarness(
  opts: {
    file?: string
    discover?: PiWebBridgeDeps['discover']
    launch?: (config: PiWebSettings) => Promise<PiWebLaunchResult>
  } = {}
) {
  const file = opts.file ?? rowsFile()
  const sent: { channel: string; payload: unknown }[] = []
  const streams: FakeStream[] = []
  let config = BASE_CONFIG
  let worktrees = [WT]
  let configListener: (() => void) | null = null
  const discover = vi.fn(opts.discover ?? (async () => URL))
  const launch = vi.fn(opts.launch ?? (async (): Promise<PiWebLaunchResult> => ({ ok: true })))
  const bridge = new PiWebBridge({
    rowsFilePath: file,
    getConfig: () => config,
    listWorktreePaths: () => worktrees,
    sendToRenderer: (channel, payload) => sent.push({ channel, payload }),
    onConfigChanged: (listener) => {
      configListener = listener
      return () => {
        configListener = null
      }
    },
    discover,
    launch,
    openStream: (url, handlers) => {
      const stream: FakeStream = { url, handlers, closed: false }
      streams.push(stream)
      return {
        close: () => {
          stream.closed = true
        }
      }
    }
  })
  bridges.push(bridge)
  return {
    bridge,
    file,
    sent,
    streams,
    discover,
    launch,
    setConfig(next: PiWebSettings) {
      config = next
      configListener?.()
    },
    setWorktrees(next: PiWebWorktreePathEntry[]) {
      worktrees = next
    }
  }
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_793_000_000_000)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  for (const bridge of bridges.splice(0)) {
    bridge.stop()
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('PiWebBridge', () => {
  it('forwards reducer deltas to renderer', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    expect(h.streams.map((s) => s.url)).toEqual([URL])

    h.streams[0].handlers.onFrame({ type: 'heartbeat' })
    h.streams[0].handlers.onFrame({ type: 'status', session: session({ cwd: '/elsewhere' }) })
    h.streams[0].handlers.onFrame({
      type: 'status',
      session: session({ status: 'awaiting_input' })
    })

    expect(h.sent).toEqual([
      {
        channel: PI_WEB_IPC.statusChanged,
        payload: {
          upserts: [
            expect.objectContaining({
              sessionId: 's1',
              worktreeId: WT.worktreeId,
              state: 'blocked'
            })
          ],
          removals: [],
          events: [
            { sessionId: 's1', worktreeId: WT.worktreeId, name: 'chat', kind: 'needs-input' }
          ]
        }
      }
    ])
  })

  it('persists and restores rows across restart', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.streams[0].handlers.onFrame({ type: 'status', session: session() })
    h.bridge.stop()
    expect(h.streams[0].closed).toBe(true)

    const next = createHarness({ file: h.file })
    next.bridge.start()

    expect(next.bridge.getSnapshot()).toEqual([
      expect.objectContaining({ sessionId: 's1', worktreeId: WT.worktreeId, state: 'working' })
    ])
  })

  it('debounces row saves until 500ms after the last change', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    const stream = h.streams[0].handlers
    const restoredIds = (): string[] => {
      const probe = createHarness({ file: h.file })
      probe.bridge.start()
      const ids = probe.bridge.getSnapshot().map((r) => r.sessionId)
      probe.bridge.stop()
      return ids
    }

    stream.onFrame({ type: 'status', session: session({ id: 'a' }) })
    await vi.advanceTimersByTimeAsync(400)
    stream.onFrame({ type: 'status', session: session({ id: 'b' }) })
    await vi.advanceTimersByTimeAsync(499)
    expect(restoredIds()).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(restoredIds()).toEqual(['a', 'b'])
  })

  it('reconnects with backoff after error', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()

    const delays = [1000, 2000, 4000, 8000, 16000, 30000, 30000]
    for (const [attempt, delay] of delays.entries()) {
      h.streams[attempt].handlers.onClose(attempt % 2 === 0 ? 'error' : 'ended')
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(h.streams).toHaveLength(attempt + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(h.streams).toHaveLength(attempt + 2)
    }

    // A delivered frame proves the link healthy, so the next drop starts over at 1s.
    const last = h.streams[delays.length].handlers
    last.onFrame({ type: 'heartbeat' })
    last.onClose('error')
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.streams).toHaveLength(delays.length + 2)
    expect(h.discover).toHaveBeenCalledTimes(delays.length + 2)
  })

  it('retries an incompatible server every 60s and warns once', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()

    h.streams[0].handlers.onClose('incompatible')
    await vi.advanceTimersByTimeAsync(59_999)
    expect(h.streams).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.streams).toHaveLength(2)
    h.streams[1].handlers.onClose('incompatible')
    await vi.advanceTimersByTimeAsync(60_000)

    expect(h.streams).toHaveLength(3)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[pi-web] server lacks /api/agent/status-events')
  })

  it('retries discovery every 15s while no server answers', async () => {
    const answers = [null, null, URL]
    const h = createHarness({ discover: async () => answers.shift() ?? null })
    h.bridge.start()
    await settle()
    expect(h.discover).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(14_999)
    expect(h.discover).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.discover).toHaveBeenCalledTimes(2)
    expect(h.streams).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(h.streams.map((s) => s.url)).toEqual([URL])
  })

  it('ensureServer launches once and waits for discovery', async () => {
    let launched = false
    let pollsSinceLaunch = 0
    const h = createHarness({
      discover: async () => {
        if (!launched) {
          return null
        }
        pollsSinceLaunch += 1
        return pollsSinceLaunch >= 3 ? URL : null
      },
      launch: async () => {
        launched = true
        return { ok: true }
      }
    })
    h.bridge.start()
    await settle()

    const first = h.bridge.ensureServer()
    const second = h.bridge.ensureServer()
    await vi.advanceTimersByTimeAsync(2999)
    expect(h.launch).toHaveBeenCalledTimes(1)
    expect(h.streams).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)

    await expect(first).resolves.toEqual({ ok: true, url: URL })
    await expect(second).resolves.toEqual({ ok: true, url: URL })
    await settle()
    // The status stream connects now instead of waiting out the 15s discovery retry.
    expect(h.streams.map((s) => s.url)).toEqual([URL])
    await expect(h.bridge.ensureServer()).resolves.toEqual({ ok: true, url: URL })
    expect(h.launch).toHaveBeenCalledTimes(1)
  })

  it('ensureServer reports a failed launch at once and gives up after 60s', async () => {
    const failing = createHarness({
      discover: async () => null,
      launch: async () => ({ ok: false, reason: 'spawn /bin/zsh ENOENT' })
    })
    await expect(failing.bridge.ensureServer()).resolves.toEqual({
      ok: false,
      reason: 'spawn /bin/zsh ENOENT'
    })
    expect(failing.discover).toHaveBeenCalledTimes(1)

    const silent = createHarness({ discover: async () => null })
    const result = silent.bridge.ensureServer()
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(result).resolves.toEqual({ ok: false, reason: expect.stringContaining('60s') })
    expect(silent.discover).toHaveBeenCalledTimes(61)
  })

  it('dismiss removes and persists', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.streams[0].handlers.onFrame({ type: 'status', session: session() })
    await vi.advanceTimersByTimeAsync(500)
    h.sent.length = 0

    h.bridge.dismiss('s1')

    expect(h.bridge.getSnapshot()).toEqual([])
    expect(h.sent).toEqual([
      { channel: PI_WEB_IPC.statusChanged, payload: { upserts: [], removals: ['s1'], events: [] } }
    ])
    const next = createHarness({ file: h.file })
    next.bridge.start()
    expect(next.bridge.getSnapshot()).toEqual([])
  })

  it('reconnects only when the resolved config changes', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()

    h.setConfig({ ...BASE_CONFIG })
    await settle()
    expect(h.streams.map((s) => s.closed)).toEqual([false])

    h.setConfig({ ...BASE_CONFIG, serverUrl: 'http://127.0.0.1:30143' })
    await settle()
    expect(h.streams.map((s) => s.closed)).toEqual([true, false])
    expect(h.discover).toHaveBeenLastCalledWith(
      expect.objectContaining({ serverUrl: 'http://127.0.0.1:30143' })
    )

    h.setConfig({ ...BASE_CONFIG, enabled: false })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(h.streams.map((s) => s.closed)).toEqual([true, true])
  })

  it('rebuilds the worktree index on snapshots and at most every 10s', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    const stream = h.streams[0].handlers
    const notes = { worktreeId: 'folder:notes', path: '/w/notes' }
    const docs = { worktreeId: 'repo::/w/docs', path: '/w/docs' }

    stream.onFrame({ type: 'snapshot', sessions: [] })
    h.setWorktrees([WT, notes])
    stream.onFrame({ type: 'status', session: session({ id: 'n', cwd: '/w/notes' }) })
    expect(h.bridge.getSnapshot()).toEqual([])
    await vi.advanceTimersByTimeAsync(10_000)
    stream.onFrame({ type: 'status', session: session({ id: 'n', cwd: '/w/notes' }) })

    h.setWorktrees([WT, notes, docs])
    stream.onFrame({
      type: 'snapshot',
      sessions: [session({ id: 'n', cwd: '/w/notes' }), session({ id: 'd', cwd: '/w/docs' })]
    })

    expect(h.bridge.getSnapshot().map((r) => [r.sessionId, r.worktreeId])).toEqual([
      ['n', 'folder:notes'],
      ['d', 'repo::/w/docs']
    ])
  })
})
