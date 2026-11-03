import type {
  PiWebAttentionEvent,
  PiWebRow,
  PiWebSessionState,
  PiWebStatusDelta,
  PiWebStatusFrame
} from '../../shared/pi-web/pi-web-status-types'

export type PiWebReducerContext = {
  resolveWorktreeId(cwd: string): string | null
  now(): number
}

type Draft = {
  rows: Map<string, PiWebRow>
  upserts: Map<string, PiWebRow>
  events: PiWebAttentionEvent[]
  ctx: PiWebReducerContext
}

function put(d: Draft, next: PiWebRow, prev: PiWebRow | undefined): void {
  if (
    prev &&
    prev.state === next.state &&
    prev.cwd === next.cwd &&
    prev.name === next.name &&
    prev.worktreeId === next.worktreeId &&
    prev.lastCompletedEndedAt === next.lastCompletedEndedAt
  ) {
    return
  }
  d.rows.set(next.sessionId, next)
  d.upserts.set(next.sessionId, next)
}

function applySession(d: Draft, s: PiWebSessionState, quiet: boolean): void {
  if (s.parentSessionId !== null) {
    return
  }
  const worktreeId = d.ctx.resolveWorktreeId(s.cwd)
  if (worktreeId === null) {
    return
  }
  const prev = d.rows.get(s.id)
  const now = d.ctx.now()
  const base = { sessionId: s.id, worktreeId, cwd: s.cwd, name: s.name, updatedAt: now }
  const keep =
    prev?.lastCompletedEndedAt === undefined
      ? {}
      : { lastCompletedEndedAt: prev.lastCompletedEndedAt }
  if (s.status === 'working') {
    const stateStartedAt = prev?.state === 'working' ? prev.stateStartedAt : now
    put(d, { ...base, ...keep, state: 'working', stateStartedAt }, prev)
  } else if (s.status === 'awaiting_input') {
    const stateStartedAt = prev?.state === 'blocked' ? prev.stateStartedAt : now
    put(d, { ...base, ...keep, state: 'blocked', stateStartedAt }, prev)
    if (!quiet && prev?.state !== 'blocked') {
      d.events.push({ sessionId: s.id, worktreeId, name: s.name, kind: 'needs-input' })
    }
  } else if (prev && prev.state !== 'done') {
    put(d, { ...base, ...keep, state: 'done', stateStartedAt: now }, prev)
  }
}

function applyCompleted(d: Draft, f: Extract<PiWebStatusFrame, { type: 'completed' }>): void {
  const worktreeId = d.ctx.resolveWorktreeId(f.cwd)
  if (worktreeId === null) {
    return
  }
  const prev = d.rows.get(f.id)
  if (prev?.lastCompletedEndedAt !== undefined && f.endedAt <= prev.lastCompletedEndedAt) {
    return
  }
  const now = d.ctx.now()
  put(
    d,
    {
      sessionId: f.id,
      worktreeId,
      cwd: f.cwd,
      name: f.name,
      state: 'done',
      stateStartedAt: prev?.state === 'done' ? prev.stateStartedAt : now,
      updatedAt: now,
      lastCompletedEndedAt: f.endedAt
    },
    prev
  )
  d.events.push({ sessionId: f.id, worktreeId, name: f.name, kind: 'completed' })
}

function settle(d: Draft, id: string): void {
  const prev = d.rows.get(id)
  if (prev && prev.state !== 'done') {
    const now = d.ctx.now()
    put(d, { ...prev, state: 'done', stateStartedAt: now, updatedAt: now }, prev)
  }
}

export function applyPiWebFrame(
  rows: ReadonlyMap<string, PiWebRow>,
  frame: PiWebStatusFrame,
  ctx: PiWebReducerContext
): { rows: Map<string, PiWebRow>; delta: PiWebStatusDelta } {
  const d: Draft = { rows: new Map(rows), upserts: new Map(), events: [], ctx }
  switch (frame.type) {
    case 'status':
      applySession(d, frame.session, false)
      break
    case 'completed':
      applyCompleted(d, frame)
      break
    case 'removed':
      settle(d, frame.id)
      break
    case 'snapshot': {
      const seen = new Set(frame.sessions.map((s) => s.id))
      for (const s of frame.sessions) {
        applySession(d, s, true)
      }
      for (const id of d.rows.keys()) {
        if (!seen.has(id)) {
          settle(d, id)
        }
      }
      break
    }
    case 'heartbeat':
      break
  }
  return {
    rows: d.rows,
    delta: { upserts: [...d.upserts.values()], removals: [], events: d.events }
  }
}
