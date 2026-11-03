import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PiWebRow } from '../../shared/pi-web/pi-web-status-types'
import { loadPiWebRows, savePiWebRows } from './pi-web-row-store'

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
    savePiWebRows(file, new Map([stale, recent, oldWorking].map((r) => [r.sessionId, r] as const)))

    const loaded = loadPiWebRows(file, NOW)

    expect([...loaded.keys()].sort()).toEqual(['recent', 'working'])
    expect(loaded.get('recent')).toEqual(recent)
    expect(readdirSync(join(file, '..'))).toEqual(['rows.json'])
  })

  it('survives corrupt file', () => {
    const file = rowsFile()
    expect(loadPiWebRows(file, NOW).size).toBe(0)

    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, '{"rows": [')
    expect(loadPiWebRows(file, NOW).size).toBe(0)

    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        rows: [{ sessionId: 7 }, null, { ...row(), state: 'bogus' }, row()]
      })
    )
    expect([...loadPiWebRows(file, NOW).values()]).toEqual([row()])
  })
})
