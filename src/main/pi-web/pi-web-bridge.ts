import {
  PI_WEB_IPC,
  type PiWebBindRequest,
  type PiWebEffectiveConfig,
  type PiWebEnsureResult,
  type PiWebEnvOverrides,
  type PiWebRow,
  type PiWebSettings,
  type PiWebStatusDelta,
  type PiWebStatusFrame
} from '../../shared/pi-web/pi-web-status-types'
import { discoverPiWebServer } from './pi-web-discovery'
import { launchPiWebServer, type PiWebLaunchResult } from './pi-web-launcher'
import { applyPiWebBinding, applyPiWebFrame, type PiWebReducerContext } from './pi-web-row-reducer'
import { loadPiWebState, savePiWebState } from './pi-web-row-store'
import { PiWebSessionBindings } from './pi-web-session-bindings'
import { openPiWebStatusStream, type PiWebStreamHandlers } from './pi-web-status-stream'

const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
const INCOMPATIBLE_RETRY_MS = 60_000
const DISCOVERY_RETRY_MS = 15_000
const SAVE_DEBOUNCE_MS = 500
const ENSURE_POLL_MS = 1_000
const ENSURE_POLL_ATTEMPTS = 60

type CloseReason = Parameters<PiWebStreamHandlers['onClose']>[0]

export type PiWebBridgeDeps = {
  rowsFilePath: string
  getConfig(): PiWebSettings
  /** The fields an ORCA_PI_WEB_* variable sets this session; the settings UI shows them read-only. */
  getEnvOverrides?(): PiWebEnvOverrides
  /** Ids of this desktop's local workspaces; a binding to any other id is ignored. */
  listWorkspaceIds(): Iterable<string>
  sendToRenderer(channel: string, payload: unknown): void
  now?(): number
  /** Called on every settings change; the bridge reconnects only if the resolved config differs. */
  onConfigChanged?(listener: () => void): () => void
  discover?(config: PiWebSettings): Promise<string | null>
  openStream?(baseUrl: string, handlers: PiWebStreamHandlers): { close(): void }
  launch?(config: PiWebSettings): Promise<PiWebLaunchResult>
}

function sameConnectionConfig(a: PiWebSettings, b: PiWebSettings): boolean {
  return a.enabled === b.enabled && a.serverUrl === b.serverUrl && a.agentDir === b.agentDir
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class PiWebBridge {
  private rows = new Map<string, PiWebRow>()
  private readonly bindings: PiWebSessionBindings
  // The server the status stream last connected to; renderer tabs on its origin bind sessions.
  private serverUrl: string | null = null
  private config: PiWebSettings | null = null
  private running = false
  // Bumped by every disconnect so callbacks from a superseded attempt are ignored.
  private generation = 0
  private stream: { close(): void } | null = null
  private streamUrl: string | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private backoffAttempt = 0
  private warnedIncompatible = false
  private ensuring: Promise<PiWebEnsureResult> | null = null
  private unsubscribeConfig: (() => void) | null = null

  constructor(private readonly deps: PiWebBridgeDeps) {
    this.bindings = new PiWebSessionBindings(() => deps.listWorkspaceIds())
  }

  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    const stored = loadPiWebState(this.deps.rowsFilePath, this.now())
    this.rows = stored.rows
    this.bindings.load(stored.bindings)
    this.config = this.deps.getConfig()
    this.unsubscribeConfig = this.deps.onConfigChanged?.(() => this.handleConfigChanged()) ?? null
    if (this.config.enabled) {
      this.connect()
    }
  }

  /** Closes the status stream only; the detached pi-web server keeps running. */
  stop(): void {
    if (!this.running) {
      return
    }
    this.running = false
    this.disconnect()
    this.unsubscribeConfig?.()
    this.unsubscribeConfig = null
    if (this.saveTimer) {
      this.flushSave()
    }
  }

  getSnapshot(): PiWebRow[] {
    return [...this.rows.values()]
  }

  getEffectiveConfig(): PiWebEffectiveConfig {
    return { config: this.deps.getConfig(), envOverrides: this.deps.getEnvOverrides?.() ?? {} }
  }

  ensureServer(): Promise<PiWebEnsureResult> {
    this.ensuring ??= this.runEnsure().finally(() => {
      this.ensuring = null
    })
    return this.ensuring
  }

  getServerUrl(): string | null {
    return this.serverUrl
  }

  /** A renderer tab of `worktreeId` shows the session: from now on its row lives there. */
  bind(request: PiWebBindRequest): void {
    const now = this.now()
    if (!this.bindings.bind(request, now)) {
      return
    }
    const known = this.bindings.lastKnownState(request.sessionId)
    const { rows, delta } = applyPiWebBinding(this.rows, request.sessionId, known, this.ctx(now))
    this.rows = rows
    this.scheduleSave()
    if (delta.upserts.length > 0) {
      this.send(delta)
    }
  }

  /** Dismissing a row also unbinds it: the conversation stays hidden until a tab opens it again. */
  dismiss(sessionId: string): void {
    this.rows.delete(sessionId)
    this.bindings.unbind(sessionId)
    this.flushSave()
    this.send({ upserts: [], removals: [sessionId], events: [] })
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  private async discover(config: PiWebSettings): Promise<string | null> {
    try {
      return await (this.deps.discover ?? discoverPiWebServer)(config)
    } catch {
      return null
    }
  }

  private async runEnsure(): Promise<PiWebEnsureResult> {
    const config = this.deps.getConfig()
    if (!config.enabled) {
      return { ok: false, reason: 'pi-web integration is disabled' }
    }
    let url = await this.discover(config)
    if (!url) {
      let launched: PiWebLaunchResult
      try {
        launched = await (this.deps.launch ?? launchPiWebServer)(config)
      } catch (error) {
        launched = { ok: false, reason: error instanceof Error ? error.message : String(error) }
      }
      if (!launched.ok) {
        return launched
      }
      for (let attempt = 0; attempt < ENSURE_POLL_ATTEMPTS && !url; attempt++) {
        await wait(ENSURE_POLL_MS)
        url = await this.discover(config)
      }
    }
    if (!url) {
      const seconds = (ENSURE_POLL_ATTEMPTS * ENSURE_POLL_MS) / 1000
      return { ok: false, reason: `pi-web did not answer within ${seconds}s of launch` }
    }
    // Why: a server that just came up should feed the sidebar now, not after the discovery retry.
    if (this.running && this.config?.enabled && this.streamUrl !== url) {
      this.connect()
    }
    return { ok: true, url }
  }

  private connect(): void {
    this.disconnect()
    const generation = this.generation
    const config = this.config ?? this.deps.getConfig()
    void this.discover(config).then((url) => {
      if (generation !== this.generation) {
        return
      }
      if (!url) {
        this.scheduleRetry(DISCOVERY_RETRY_MS)
        return
      }
      const stream = (this.deps.openStream ?? openPiWebStatusStream)(url, {
        onFrame: (frame) => {
          if (generation === this.generation) {
            this.handleFrame(frame)
          }
        },
        onClose: (reason, detail) => {
          if (generation === this.generation) {
            this.handleClose(reason, detail)
          }
        }
      })
      if (generation !== this.generation) {
        stream.close()
        return
      }
      this.stream = stream
      this.streamUrl = url
      this.publishServerUrl(url)
    })
  }

  private publishServerUrl(url: string): void {
    if (this.serverUrl !== url) {
      this.serverUrl = url
      this.deps.sendToRenderer(PI_WEB_IPC.serverUrlChanged, url)
    }
  }

  private disconnect(): void {
    this.generation += 1
    this.stream?.close()
    this.stream = null
    this.streamUrl = null
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private scheduleRetry(delayMs: number): void {
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delayMs)
  }

  private handleClose(reason: CloseReason, detail?: string): void {
    this.disconnect()
    if (reason === 'incompatible') {
      if (!this.warnedIncompatible) {
        this.warnedIncompatible = true
        const why = detail ? ` (${detail})` : ''
        console.warn(`[pi-web] server lacks /api/agent/status-events${why}`)
      }
      this.scheduleRetry(INCOMPATIBLE_RETRY_MS)
      return
    }
    const delayMs = Math.min(INITIAL_BACKOFF_MS * 2 ** this.backoffAttempt, MAX_BACKOFF_MS)
    this.backoffAttempt = Math.min(this.backoffAttempt + 1, 16)
    this.scheduleRetry(delayMs)
  }

  private handleConfigChanged(): void {
    if (!this.running) {
      return
    }
    const next = this.deps.getConfig()
    if (this.config && sameConnectionConfig(this.config, next)) {
      this.config = next
      return
    }
    this.config = next
    this.backoffAttempt = 0
    if (next.enabled) {
      this.connect()
    } else {
      this.disconnect()
    }
  }

  private handleFrame(frame: PiWebStatusFrame): void {
    this.backoffAttempt = 0
    this.warnedIncompatible = false
    if (frame.type === 'heartbeat') {
      return
    }
    const now = this.now()
    this.bindings.noteFrame(frame, now)
    const { rows, delta } = applyPiWebFrame(this.rows, frame, this.ctx(now))
    this.rows = rows
    if (delta.upserts.length > 0 || delta.removals.length > 0) {
      this.bindings.touch(
        delta.upserts.map((row) => row.sessionId),
        now
      )
      this.scheduleSave()
    }
    if (delta.upserts.length > 0 || delta.removals.length > 0 || delta.events.length > 0) {
      this.send(delta)
    }
  }

  private ctx(now: number): PiWebReducerContext {
    return { resolveWorktreeId: (sessionId) => this.bindings.resolve(sessionId), now: () => now }
  }

  private send(delta: PiWebStatusDelta): void {
    this.deps.sendToRenderer(PI_WEB_IPC.statusChanged, delta)
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => this.flushSave(), SAVE_DEBOUNCE_MS)
  }

  private flushSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    try {
      savePiWebState(this.deps.rowsFilePath, this.rows, this.bindings.all())
    } catch (error) {
      console.warn('[pi-web] failed to save rows', error)
    }
  }
}
