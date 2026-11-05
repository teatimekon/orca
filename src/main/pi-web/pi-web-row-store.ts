import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PiWebBinding, PiWebRow, PiWebRowState } from '../../shared/pi-web/pi-web-status-types'
import { renameFileWithWindowsRetry } from '../../shared/windows-retry-file-operations'

const DONE_ROW_RETENTION_MS = 24 * 60 * 60 * 1000
const IDLE_BINDING_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
// v1 rows were mapped to workspaces by cwd; v2 rows exist only for sessions an Orca tab opened.
const STORE_VERSION = 2

export type PiWebStoredState = {
  rows: Map<string, PiWebRow>
  bindings: Map<string, PiWebBinding>
}

function isRowState(value: unknown): value is PiWebRowState {
  return value === 'working' || value === 'blocked' || value === 'done'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function fieldsOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? Object.fromEntries(Object.entries(value))
    : null
}

function readRow(value: unknown): PiWebRow | null {
  const fields = fieldsOf(value)
  if (!fields) {
    return null
  }
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

function readBinding(value: unknown): PiWebBinding | null {
  const fields = fieldsOf(value)
  const sessionId = fields?.sessionId
  const worktreeId = fields?.worktreeId
  const touchedAt = fields?.touchedAt
  return typeof sessionId === 'string' &&
    sessionId &&
    typeof worktreeId === 'string' &&
    worktreeId &&
    isFiniteNumber(touchedAt)
    ? { sessionId, worktreeId, touchedAt }
    : null
}

function listOf(parsed: Record<string, unknown>, key: string): unknown[] {
  const value = parsed[key]
  return Array.isArray(value) ? value : []
}

export function loadPiWebState(filePath: string, now: number): PiWebStoredState {
  const state: PiWebStoredState = { rows: new Map(), bindings: new Map() }
  let parsed: Record<string, unknown> | null
  try {
    parsed = fieldsOf(JSON.parse(readFileSync(filePath, 'utf8')))
  } catch {
    // Why: a missing or half-written file only costs the sidebar its remembered rows.
    return state
  }
  // Why: older files hold cwd-mapped rows for conversations no Orca tab opened; they must not come back.
  if (!parsed || parsed.version !== STORE_VERSION) {
    return state
  }
  for (const entry of listOf(parsed, 'bindings')) {
    const binding = readBinding(entry)
    if (binding) {
      state.bindings.set(binding.sessionId, binding)
    }
  }
  for (const entry of listOf(parsed, 'rows')) {
    const row = readRow(entry)
    const binding = row ? state.bindings.get(row.sessionId) : undefined
    // A row always lives in its binding's workspace; anything else is a stale write.
    if (!row || binding?.worktreeId !== row.worktreeId) {
      continue
    }
    if (!(row.state === 'done' && now - row.updatedAt > DONE_ROW_RETENTION_MS)) {
      state.rows.set(row.sessionId, row)
    }
  }
  for (const [sessionId, binding] of state.bindings) {
    if (!state.rows.has(sessionId) && now - binding.touchedAt > IDLE_BINDING_RETENTION_MS) {
      state.bindings.delete(sessionId)
    }
  }
  return state
}

export function savePiWebState(
  filePath: string,
  rows: ReadonlyMap<string, PiWebRow>,
  bindings: ReadonlyMap<string, PiWebBinding>
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.${process.pid}.tmp`
  const body = {
    version: STORE_VERSION,
    bindings: [...bindings.values()],
    rows: [...rows.values()]
  }
  try {
    writeFileSync(tmpPath, JSON.stringify(body), 'utf8')
    renameFileWithWindowsRetry(tmpPath, filePath)
  } catch (error) {
    rmSync(tmpPath, { force: true })
    throw error
  }
}
