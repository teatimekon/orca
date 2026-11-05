import type {
  PiWebBindRequest,
  PiWebBinding,
  PiWebSessionState,
  PiWebStatusFrame
} from '../../shared/pi-web/pi-web-status-types'
import { worktreeIdentityKey } from '../../shared/worktree/id'

const WORKSPACE_REFRESH_MS = 10_000

/** Which Orca workspace each pi-web conversation belongs to: the last one whose browser tab showed it. */
export class PiWebSessionBindings {
  private bindings = new Map<string, PiWebBinding>()
  // Last state pi-web reported per loaded session, so a bind can show a run already under way.
  private readonly sessions = new Map<string, PiWebSessionState>()
  // Identity keys, so a renderer id that spells the path differently still matches.
  private workspaceKeys = new Set<string>()
  private workspacesReadAt = Number.NEGATIVE_INFINITY

  /** `listWorkspaceIds`: this desktop's local workspaces, the only ones pi-web conversations can live in. */
  constructor(private readonly listWorkspaceIds: () => Iterable<string>) {}

  load(bindings: Map<string, PiWebBinding>): void {
    this.bindings = bindings
  }

  all(): ReadonlyMap<string, PiWebBinding> {
    return this.bindings
  }

  lastKnownState(sessionId: string): PiWebSessionState | undefined {
    return this.sessions.get(sessionId)
  }

  noteFrame(frame: PiWebStatusFrame, now: number): void {
    if (frame.type === 'snapshot' || now - this.workspacesReadAt >= WORKSPACE_REFRESH_MS) {
      this.refreshWorkspaces(now)
    }
    if (frame.type === 'snapshot') {
      this.sessions.clear()
      for (const session of frame.sessions) {
        this.sessions.set(session.id, session)
      }
    } else if (frame.type === 'status') {
      this.sessions.set(frame.session.id, frame.session)
    } else if (frame.type === 'removed') {
      // Why not unbind: pi-web unloads idle sessions (10 min) and on restart; the conversation still belongs to its tab.
      this.sessions.delete(frame.id)
    }
  }

  /** The bound workspace, or null when unbound or that workspace is gone from this desktop. */
  resolve(sessionId: string): string | null {
    const worktreeId = this.bindings.get(sessionId)?.worktreeId
    return worktreeId !== undefined && this.isLocalWorkspace(worktreeId) ? worktreeId : null
  }

  /** True when the binding changed. */
  bind(request: PiWebBindRequest, now: number): boolean {
    const existing = this.bindings.get(request.sessionId)
    if (existing?.worktreeId === request.worktreeId) {
      return false
    }
    if (!this.isLocalWorkspace(request.worktreeId)) {
      // A workspace created since the last read must not lose its first bind.
      this.refreshWorkspaces(now)
      if (!this.isLocalWorkspace(request.worktreeId)) {
        return false
      }
    }
    if (request.restored && existing && this.isLocalWorkspace(existing.worktreeId)) {
      return false
    }
    this.bindings.set(request.sessionId, {
      sessionId: request.sessionId,
      worktreeId: request.worktreeId,
      touchedAt: now
    })
    return true
  }

  unbind(sessionId: string): void {
    this.bindings.delete(sessionId)
  }

  touch(sessionIds: Iterable<string>, now: number): void {
    for (const sessionId of sessionIds) {
      const binding = this.bindings.get(sessionId)
      if (binding) {
        this.bindings.set(sessionId, { ...binding, touchedAt: now })
      }
    }
  }

  private isLocalWorkspace(worktreeId: string): boolean {
    return this.workspaceKeys.has(worktreeIdentityKey(worktreeId))
  }

  private refreshWorkspaces(now: number): void {
    try {
      this.workspaceKeys = new Set(
        [...this.listWorkspaceIds()].map((id) => worktreeIdentityKey(id))
      )
    } catch (error) {
      console.warn('[pi-web] failed to list workspaces', error)
    }
    this.workspacesReadAt = now
  }
}
