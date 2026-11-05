import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PiWebBinding, PiWebRow } from '../../shared/pi-web/pi-web-status-types'
import { loadPiWebState, savePiWebState } from './pi-web-row-store'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = 10 * DAY_MS
const dirs: string[] = []

function rowsFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pi-web-row-store-'))
  dirs.push(dir)
  return join(dir, 'pi-web', 'rows.json')
}

function row(over: Partial<PiWebRow> = {}): PiWebRow {
  return {
    sessionId: 's1',
    worktreeId: 'repo::/w/a',
    cwd: '/w/a',
    name: 'n',
    state: 'done',
    stateStartedAt: NOW,
    updatedAt: NOW,
    ...over
  }
}

function binding(sessionId: string, over: Partial<PiWebBinding> = {}): PiWebBinding {
  return { sessionId, worktreeId: 'repo::/w/a', touchedAt: NOW, ...over }
}

function byId<T extends { sessionId: string }>(...items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.sessionId, item] as const))
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('pi-web row store', () => {
  it('drops done rows older than 24h', () => {
    const file = rowsFile()
    const stale = row({ sessionId: 'stale', updatedAt: NOW - DAY_MS - 1 })
    const recent = row({
      sessionId: 'recent',
      updatedAt: NOW - DAY_MS + 1,
      lastCompletedEndedAt: 7
    })
    const oldWorking = row({ sessionId: 'working', state: 'working', updatedAt: NOW - 3 * DAY_MS })
    const rows = byId(stale, recent, oldWorking)
    savePiWebState(file, rows, byId(...[...rows.keys()].map((id) => binding(id))))

    const loaded = loadPiWebState(file, NOW).rows

    expect([...loaded.keys()].sort()).toEqual(['recent', 'working'])
    expect(loaded.get('recent')).toEqual(recent)
    expect(readdirSync(join(file, '..'))).toEqual(['rows.json'])
  })

  it('survives corrupt file', () => {
    const file = rowsFile()
    expect(loadPiWebState(file, NOW).rows.size).toBe(0)

    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, '{"rows": [')
    expect(loadPiWebState(file, NOW).rows.size).toBe(0)

    writeFileSync(
      file,
      JSON.stringify({
        version: 2,
        bindings: [{ sessionId: 's1' }, null, binding('s1')],
        rows: [{ sessionId: 7 }, null, { ...row(), state: 'bogus' }, row()]
      })
    )
    const loaded = loadPiWebState(file, NOW)
    expect([...loaded.rows.values()]).toEqual([row()])
    expect([...loaded.bindings.values()]).toEqual([binding('s1')])
  })

  it('drops every v1 row: they were mapped by cwd, not opened in an Orca tab', () => {
    const file = rowsFile()
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, JSON.stringify({ version: 1, rows: [row(), row({ sessionId: 's2' })] }))

    const loaded = loadPiWebState(file, NOW)

    expect(loaded.rows.size).toBe(0)
    expect(loaded.bindings.size).toBe(0)
  })

  it('keeps rows only in their binding workspace and expires idle bindings after 30 days', () => {
    const file = rowsFile()
    const old = NOW - 31 * DAY_MS
    savePiWebState(
      file,
      byId(
        row({ sessionId: 'kept', state: 'working', updatedAt: old }),
        row({ sessionId: 'unbound' }),
        row({ sessionId: 'moved', worktreeId: 'repo::/w/b' })
      ),
      byId(
        binding('kept', { touchedAt: old }),
        binding('moved'),
        binding('fresh', { touchedAt: NOW - 29 * DAY_MS }),
        binding('stale', { touchedAt: old })
      )
    )

    const loaded = loadPiWebState(file, NOW)

    expect([...loaded.rows.keys()]).toEqual(['kept'])
    expect([...loaded.bindings.keys()].sort()).toEqual(['fresh', 'kept', 'moved'])
  })
})
