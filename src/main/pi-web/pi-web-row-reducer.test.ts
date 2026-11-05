import { describe, expect, it } from 'vitest'
import type {
  PiWebRow,
  PiWebSessionState,
  PiWebStatusFrame
} from '../../shared/pi-web/pi-web-status-types'
import { applyPiWebBinding, applyPiWebFrame, type PiWebReducerContext } from './pi-web-row-reducer'

// s1 was opened in an Orca tab of wt1; every other session is unbound.
const bound: Record<string, string> = { s1: 'wt1' }
const ctx: PiWebReducerContext = {
  resolveWorktreeId: (sessionId) => bound[sessionId] ?? null,
  now: () => 1000
}

function session(over: Partial<PiWebSessionState> = {}): PiWebSessionState {
  return {
    id: 's1',
    cwd: '/wt/a',
    name: 'n',
    parentSessionId: null,
    status: 'working',
    aborted: false,
    lastRunEndedAt: null,
    lastRunAborted: false,
    ...over
  }
}

function row(over: Partial<PiWebRow> = {}): PiWebRow {
  return {
    sessionId: 's1',
    worktreeId: 'wt1',
    cwd: '/wt/a',
    name: 'n',
    state: 'working',
    stateStartedAt: 500,
    updatedAt: 500,
    ...over
  }
}

const rowsOf = (...r: PiWebRow[]): Map<string, PiWebRow> => new Map(r.map((x) => [x.sessionId, x]))
const status = (over: Partial<PiWebSessionState>): PiWebStatusFrame => ({
  type: 'status',
  session: session(over)
})
const completed = (endedAt: number): PiWebStatusFrame => ({
  type: 'completed',
  id: 's1',
  cwd: '/wt/a',
  name: 'n',
  endedAt
})

describe('applyPiWebFrame', () => {
  it('ignores child sessions with a parentSessionId', () => {
    const r = applyPiWebFrame(rowsOf(), status({ parentSessionId: 'p' }), ctx)
    expect(r.rows.size).toBe(0)
    expect(r.delta.upserts).toEqual([])
  })

  it('ignores a session no Orca tab opened, whatever its cwd', () => {
    const frames: PiWebStatusFrame[] = [
      status({ id: 'phone' }),
      status({ id: 'phone', status: 'awaiting_input' }),
      { type: 'completed', id: 'phone', cwd: '/wt/a', name: 'n', endedAt: 900 },
      { type: 'snapshot', sessions: [session({ id: 'phone' })] }
    ]
    for (const frame of frames) {
      const r = applyPiWebFrame(rowsOf(), frame, ctx)
      expect(r.rows.size).toBe(0)
      expect(r.delta).toEqual({ upserts: [], removals: [], events: [] })
    }
  })

  it('maps a bound session to its tab workspace, not to its cwd', () => {
    const r = applyPiWebFrame(rowsOf(), status({ cwd: '/elsewhere/sub/dir' }), ctx)
    expect(r.rows.get('s1')).toMatchObject({ worktreeId: 'wt1', cwd: '/elsewhere/sub/dir' })
  })

  it('working status creates a working row at now', () => {
    const r = applyPiWebFrame(rowsOf(), status({}), ctx)
    expect(r.rows.get('s1')).toMatchObject({ state: 'working', stateStartedAt: 1000 })
    expect(r.delta.upserts).toHaveLength(1)
  })

  it('working status keeps stateStartedAt when already working', () => {
    const r = applyPiWebFrame(rowsOf(row()), status({}), ctx)
    expect(r.rows.get('s1')?.stateStartedAt).toBe(500)
    expect(r.delta.upserts).toEqual([])
  })

  it('awaiting_input becomes blocked and notifies once', () => {
    const r = applyPiWebFrame(rowsOf(row()), status({ status: 'awaiting_input' }), ctx)
    expect(r.rows.get('s1')?.state).toBe('blocked')
    expect(r.delta.events).toEqual([
      { sessionId: 's1', worktreeId: 'wt1', name: 'n', kind: 'needs-input' }
    ])
    const again = applyPiWebFrame(r.rows, status({ status: 'awaiting_input' }), ctx)
    expect(again.delta.events).toEqual([])
  })

  it('idle status settles an existing row to done quietly', () => {
    const r = applyPiWebFrame(rowsOf(row()), status({ status: 'idle' }), ctx)
    expect(r.rows.get('s1')?.state).toBe('done')
    expect(r.delta.events).toEqual([])
    expect(r.delta.upserts).toHaveLength(1)
  })

  it('idle status without a row does nothing', () => {
    const r = applyPiWebFrame(rowsOf(), status({ status: 'idle' }), ctx)
    expect(r.rows.size).toBe(0)
  })

  it('fast run with no working frame still notifies', () => {
    const r = applyPiWebFrame(rowsOf(), completed(900), ctx)
    expect(r.rows.get('s1')?.state).toBe('done')
    expect(r.delta.events).toEqual([
      { sessionId: 's1', worktreeId: 'wt1', name: 'n', kind: 'completed' }
    ])
  })

  it('completed after idle still notifies', () => {
    const idle = applyPiWebFrame(rowsOf(row()), status({ status: 'idle' }), ctx)
    const r = applyPiWebFrame(idle.rows, completed(900), ctx)
    expect(r.delta.events).toHaveLength(1)
    expect(r.delta.events[0].kind).toBe('completed')
  })

  it('duplicate completed for same run notifies once', () => {
    const first = applyPiWebFrame(rowsOf(row()), completed(900), ctx)
    expect(first.delta.events).toHaveLength(1)
    const second = applyPiWebFrame(first.rows, completed(900), ctx)
    expect(second.delta.events).toEqual([])
    const next = applyPiWebFrame(second.rows, completed(950), ctx)
    expect(next.delta.events).toHaveLength(1)
  })

  it('removed frame settles working and blocked rows quietly', () => {
    const r = applyPiWebFrame(rowsOf(row()), { type: 'removed', id: 's1' }, ctx)
    expect(r.rows.get('s1')?.state).toBe('done')
    expect(r.delta.events).toEqual([])
    const b = applyPiWebFrame(rowsOf(row({ state: 'blocked' })), { type: 'removed', id: 's1' }, ctx)
    expect(b.rows.get('s1')?.state).toBe('done')
  })

  it('removed frame keeps a done row', () => {
    const r = applyPiWebFrame(rowsOf(row({ state: 'done' })), { type: 'removed', id: 's1' }, ctx)
    expect(r.rows.get('s1')?.state).toBe('done')
    expect(r.delta.upserts).toEqual([])
  })

  it('snapshot handles sessions quietly, including awaiting_input', () => {
    const r = applyPiWebFrame(
      rowsOf(),
      { type: 'snapshot', sessions: [session({ status: 'awaiting_input' })] },
      ctx
    )
    expect(r.rows.get('s1')?.state).toBe('blocked')
    expect(r.delta.events).toEqual([])
  })

  it('snapshot settles stale working rows quietly', () => {
    const r = applyPiWebFrame(rowsOf(row()), { type: 'snapshot', sessions: [] }, ctx)
    expect(r.rows.get('s1')?.state).toBe('done')
    expect(r.delta.events).toEqual([])
    expect(r.delta.upserts).toHaveLength(1)
  })

  it('snapshot does not create rows for idle sessions', () => {
    const r = applyPiWebFrame(
      rowsOf(),
      { type: 'snapshot', sessions: [session({ status: 'idle' })] },
      ctx
    )
    expect(r.rows.size).toBe(0)
  })

  it('heartbeat changes nothing', () => {
    const r = applyPiWebFrame(rowsOf(row()), { type: 'heartbeat' }, ctx)
    expect(r.delta).toEqual({ upserts: [], removals: [], events: [] })
    expect(r.rows.get('s1')).toEqual(row())
  })
})

describe('applyPiWebBinding', () => {
  const movedTo = (worktreeId: string): PiWebReducerContext => ({
    resolveWorktreeId: (sessionId) => (sessionId === 's1' ? worktreeId : null),
    now: () => 2000
  })

  it('a run already under way when its tab binds it shows at once, without a notification', () => {
    const working = applyPiWebBinding(rowsOf(), 's1', session(), ctx)
    expect(working.rows.get('s1')).toMatchObject({ worktreeId: 'wt1', state: 'working' })
    expect(working.delta.upserts).toHaveLength(1)

    const blocked = applyPiWebBinding(rowsOf(), 's1', session({ status: 'awaiting_input' }), ctx)
    expect(blocked.rows.get('s1')?.state).toBe('blocked')
    expect(blocked.delta.events).toEqual([])
  })

  it('an idle or unknown session gets no row until it runs', () => {
    expect(applyPiWebBinding(rowsOf(), 's1', session({ status: 'idle' }), ctx).rows.size).toBe(0)
    expect(applyPiWebBinding(rowsOf(), 's1', undefined, ctx).delta.upserts).toEqual([])
  })

  it('rebinding moves the row, done or not, to the new workspace', () => {
    const done = row({ state: 'done', lastCompletedEndedAt: 900 })
    const r = applyPiWebBinding(rowsOf(done), 's1', undefined, movedTo('wt2'))
    expect(r.rows.get('s1')).toEqual({ ...done, worktreeId: 'wt2', updatedAt: 2000 })
    expect(r.delta.upserts).toEqual([r.rows.get('s1')])

    const next = applyPiWebFrame(r.rows, status({ status: 'awaiting_input' }), movedTo('wt2'))
    expect(next.delta.events).toEqual([
      { sessionId: 's1', worktreeId: 'wt2', name: 'n', kind: 'needs-input' }
    ])
  })
})
