import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PiWebRow, PiWebRowState } from '../../shared/pi-web/pi-web-status-types'
import { renameFileWithWindowsRetry } from '../../shared/windows-retry-file-operations'

const DONE_ROW_RETENTION_MS = 24 * 60 * 60 * 1000

function isRowState(value: unknown): value is PiWebRowState {
  return value === 'working' || value === 'blocked' || value === 'done'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function readRow(value: unknown): PiWebRow | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const fields: Record<string, unknown> = Object.fromEntries(Object.entries(value))
  const { sessionId, worktreeId, cwd, name, state, stateStartedAt, updatedAt } = fields
  if (
    typeof sessionId !== 'string' ||
    !sessionId ||
    typeof worktreeId !== 'string' ||
    typeof cwd !== 'string' ||
    (name !== null && typeof name !== 'string') ||
    !isRowState(state) ||
    !isFiniteNumber(stateStartedAt) ||
    !isFiniteNumber(updatedAt)
  ) {
    return null
  }
  const row: PiWebRow = { sessionId, worktreeId, cwd, name, state, stateStartedAt, updatedAt }
  if (isFiniteNumber(fields.lastCompletedEndedAt)) {
    row.lastCompletedEndedAt = fields.lastCompletedEndedAt
  }
  return row
}

export function loadPiWebRows(filePath: string, now: number): Map<string, PiWebRow> {
  const rows = new Map<string, PiWebRow>()
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    // Why: a missing or half-written file only costs the sidebar its remembered rows.
    return rows
  }
  const entries =
    typeof parsed === 'object' && parsed !== null && 'rows' in parsed && Array.isArray(parsed.rows)
      ? parsed.rows
      : []
  for (const entry of entries) {
    const row = readRow(entry)
    if (row && !(row.state === 'done' && now - row.updatedAt > DONE_ROW_RETENTION_MS)) {
      rows.set(row.sessionId, row)
    }
  }
  return rows
}

export function savePiWebRows(filePath: string, rows: ReadonlyMap<string, PiWebRow>): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.${process.pid}.tmp`
  try {
    writeFileSync(tmpPath, JSON.stringify({ version: 1, rows: [...rows.values()] }), 'utf8')
    renameFileWithWindowsRetry(tmpPath, filePath)
  } catch (error) {
    rmSync(tmpPath, { force: true })
    throw error
  }
}
