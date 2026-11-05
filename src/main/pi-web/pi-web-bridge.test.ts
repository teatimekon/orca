import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  DEFAULT_PI_WEB_SETTINGS,
  PI_WEB_IPC,
  type PiWebBindRequest,
  type PiWebSessionState,
  type PiWebSettings
} from '../../shared/pi-web/pi-web-status-types'
import { PiWebBridge, type PiWebBridgeDeps } from './pi-web-bridge'
import type { PiWebLaunchResult } from './pi-web-launcher'
import type { PiWebStreamHandlers } from './pi-web-status-stream'

const URL = 'http://127.0.0.1:30142'
const WT = 'repo::/w/proj'
const OTHER = 'folder:notes'
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
  let workspaces = [WT, OTHER]
  let configListener: (() => void) | null = null
  const discover = vi.fn(opts.discover ?? (async () => URL))
  const launch = vi.fn(opts.launch ?? (async (): Promise<PiWebLaunchResult> => ({ ok: true })))
  const bridge = new PiWebBridge({
    rowsFilePath: file,
    getConfig: () => config,
    listWorkspaceIds: () => workspaces,
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
  const h = {
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
    setWorkspaces(next: string[]) {
      workspaces = next
    },
    /** Status deltas only, in order. */
    deltas() {
      return h.sent.filter((m) => m.channel === PI_WEB_IPC.statusChanged).map((m) => m.payload)
    },
    frame(frame: Parameters<PiWebStreamHandlers['onFrame']>[0]) {
      h.streams.at(-1)?.handlers.onFrame(frame)
    }
  }
  return h
}

function opened(sessionId: string, worktreeId = WT): PiWebBindRequest {
  return { sessionId, worktreeId, restored: false }
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
    h.bridge.bind(opened('s1'))
    h.sent.length = 0

    h.streams[0].handlers.onFrame({ type: 'heartbeat' })
    h.streams[0].handlers.onFrame({ type: 'status', session: session({ id: 'phone' }) })
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
              worktreeId: WT,
              state: 'blocked'
            })
          ],
          removals: [],
          events: [{ sessionId: 's1', worktreeId: WT, name: 'chat', kind: 'needs-input' }]
        }
      }
    ])
  })

  it('persists rows and bindings across restart', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.bridge.bind(opened('s1'))
    h.bridge.bind(opened('idle'))
    h.frame({ type: 'status', session: session() })
    h.bridge.stop()
    expect(h.streams[0].closed).toBe(true)

    const next = createHarness({ file: h.file })
    next.bridge.start()
    await settle()

    expect(next.bridge.getSnapshot()).toEqual([
      expect.objectContaining({ sessionId: 's1', worktreeId: WT, state: 'working' })
    ])
    next.frame({ type: 'snapshot', sessions: [session({ id: 'idle' })] })
    expect(next.bridge.getSnapshot().map((r) => r.sessionId)).toEqual(['s1', 'idle'])
  })

  it('debounces row saves until 500ms after the last change', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.bridge.bind(opened('a'))
    h.bridge.bind(opened('b'))
    await vi.advanceTimersByTimeAsync(500)
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

  it('dismiss removes the row, unbinds the session and persists', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.bridge.bind(opened('s1'))
    h.frame({ type: 'status', session: session() })
    await vi.advanceTimersByTimeAsync(500)
    h.sent.length = 0

    h.bridge.dismiss('s1')
    h.frame({ type: 'completed', id: 's1', cwd: '/w/proj', name: 'chat', endedAt: 5 })

    expect(h.bridge.getSnapshot()).toEqual([])
    expect(h.sent).toEqual([
      { channel: PI_WEB_IPC.statusChanged, payload: { upserts: [], removals: ['s1'], events: [] } }
    ])
    const next = createHarness({ file: h.file })
    next.bridge.start()
    await settle()
    next.frame({ type: 'status', session: session() })
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

  it('rows come only from sessions an Orca tab opened, whatever their cwd', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.frame({ type: 'snapshot', sessions: [] })
    h.frame({ type: 'status', session: session({ id: 'api', cwd: '/w/proj' }) })
    h.frame({ type: 'status', session: session({ id: 'sub', cwd: '/w/proj/docs/sft' }) })
    h.frame({ type: 'completed', id: 'api', cwd: '/w/proj', name: 'chat', endedAt: 5 })
    expect(h.deltas()).toEqual([])

    // The composer tab turns to ?session=sub mid-run: the row shows at once, quietly.
    h.bridge.bind(opened('sub', OTHER))
    h.frame({ type: 'status', session: session({ id: 'sub', status: 'idle' }) })
    h.frame({ type: 'completed', id: 'sub', cwd: '/w/proj/docs/sft', name: 'chat', endedAt: 9 })

    expect(h.deltas()).toEqual([
      {
        upserts: [
          expect.objectContaining({ sessionId: 'sub', worktreeId: OTHER, state: 'working' })
        ],
        removals: [],
        events: []
      },
      { upserts: [expect.objectContaining({ state: 'done' })], removals: [], events: [] },
      {
        upserts: [expect.objectContaining({ lastCompletedEndedAt: 9 })],
        removals: [],
        events: [{ sessionId: 'sub', worktreeId: OTHER, name: 'chat', kind: 'completed' }]
      }
    ])
    expect(h.bridge.getSnapshot().map((r) => r.sessionId)).toEqual(['sub'])
  })

  it('a newer tab moves the row; a tab restored at startup keeps the existing binding', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.bridge.bind(opened('s1'))
    h.frame({ type: 'status', session: session() })

    h.bridge.bind({ sessionId: 's1', worktreeId: OTHER, restored: true })
    expect(h.bridge.getSnapshot()).toEqual([expect.objectContaining({ worktreeId: WT })])

    h.bridge.bind(opened('s1', OTHER))
    expect(h.bridge.getSnapshot()).toEqual([expect.objectContaining({ worktreeId: OTHER })])
    expect(h.deltas().at(-1)).toEqual({
      upserts: [expect.objectContaining({ sessionId: 's1', worktreeId: OTHER, state: 'working' })],
      removals: [],
      events: []
    })

    // A restored tab does bind a session nobody holds, e.g. after the v1 rows were dropped.
    h.bridge.bind({ sessionId: 's2', worktreeId: WT, restored: true })
    h.frame({ type: 'status', session: session({ id: 's2' }) })
    expect(h.bridge.getSnapshot().map((r) => [r.sessionId, r.worktreeId])).toEqual([
      ['s1', OTHER],
      ['s2', WT]
    ])
  })

  it('keeps the binding when pi-web unloads an idle session', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.bridge.bind(opened('s1'))
    h.frame({ type: 'status', session: session() })
    h.frame({ type: 'removed', id: 's1' })
    expect(h.bridge.getSnapshot()).toEqual([expect.objectContaining({ state: 'done' })])

    h.frame({ type: 'status', session: session() })

    expect(h.bridge.getSnapshot()).toEqual([expect.objectContaining({ state: 'working' })])
  })

  it('binds only to local workspaces, re-reading them for one created since', async () => {
    const h = createHarness()
    h.bridge.start()
    await settle()
    h.frame({ type: 'snapshot', sessions: [session({ id: 'n' }), session({ id: 'r' })] })

    h.bridge.bind(opened('r', 'ssh-repo::/srv/app'))
    h.setWorkspaces([WT, OTHER, 'repo::/w/proj.wt/new'])
    h.bridge.bind(opened('n', 'repo::/w/proj.wt/new'))

    expect(h.bridge.getSnapshot().map((r) => [r.sessionId, r.worktreeId])).toEqual([
      ['n', 'repo::/w/proj.wt/new']
    ])

    // A removed workspace's sessions go quiet instead of notifying for a workspace that is gone.
    const sentBefore = h.deltas().length
    h.setWorkspaces([WT, OTHER])
    h.frame({ type: 'snapshot', sessions: [session({ id: 'n', status: 'awaiting_input' })] })
    h.frame({ type: 'completed', id: 'n', cwd: '/w/proj', name: 'chat', endedAt: 5 })
    expect(h.deltas()).toHaveLength(sentBefore)
  })

  it('tells the renderer which server its tabs bind against', async () => {
    const h = createHarness()
    expect(h.bridge.getServerUrl()).toBeNull()
    h.bridge.start()
    await settle()
    h.streams[0].handlers.onClose('error')
    await vi.advanceTimersByTimeAsync(1000)

    expect(h.bridge.getServerUrl()).toBe(URL)
    expect(h.sent.filter((m) => m.channel === PI_WEB_IPC.serverUrlChanged)).toEqual([
      { channel: PI_WEB_IPC.serverUrlChanged, payload: URL }
    ])
  })
})

describe('PiWebBridge effective config', () => {
  it('reports the resolved config and the env variables behind it', () => {
    const bridge = new PiWebBridge({
      rowsFilePath: rowsFile(),
      getConfig: () => BASE_CONFIG,
      getEnvOverrides: () => ({ agentDir: 'ORCA_PI_WEB_AGENT_DIR' }),
      listWorkspaceIds: () => [],
      sendToRenderer: () => {}
    })
    expect(bridge.getEffectiveConfig()).toEqual({
      config: BASE_CONFIG,
      envOverrides: { agentDir: 'ORCA_PI_WEB_AGENT_DIR' }
    })
    const plain = new PiWebBridge({
      rowsFilePath: rowsFile(),
      getConfig: () => BASE_CONFIG,
      listWorkspaceIds: () => [],
      sendToRenderer: () => {}
    })
    expect(plain.getEffectiveConfig()).toEqual({ config: BASE_CONFIG, envOverrides: {} })
  })
})
