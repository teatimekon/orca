import { statSync } from 'node:fs'
import type { AgentProviderSessionMetadata } from '../agent-session/lifecycle/agent-session-resume'
import {
  isClaudeSessionId,
  parseRecord,
  readJobState,
  resolveAttachedJobSession,
  resolveClearedJobSession,
  resolveForkedSession
} from './claude-session-continuation-jobs'
import type { AgentHookEventPayload } from './listener-event'
import { scanFileRegionsBackward } from './reverse-file-region-scan'
import { TRANSCRIPT_CHUNK_BYTES } from './transcript-reader'

const FIRST_SCAN_BYTES = 1024 * 1024
// Why: a rescan reads only what was appended, plus enough to re-read a line split at the old end.
const RESCAN_OVERLAP_BYTES = 64 * 1024
const MAX_CONTINUATION_HOPS = 8
const MAX_REMEMBERED_ENTRIES = 256
// Claude Code accepts only this shape for continuedInSessionId; it also keeps ids out of path joins.
// Claude Code skips tagged text (commands, reminders) and interrupt markers when finding prompts.
const NOT_A_PROMPT = /^\s*<[a-z][\w-]*[\s>]|^\[Request interrupted by user/
// Claude Code names the job it attached to (`/resume`, `/fork`) in its own command output; the
// `continued-in` record it writes beside that output can name a session that never reaches disk.
const BACKGROUND_JOB_OUTPUT = /running in the background \(([0-9a-f]{8})\)/

type ContinuationScan = { pointer: string | null; jobShortId?: string }

/**
 * Follows the `continued-in` record Claude Code writes when it forks a pane's session into a
 * daemon job. That job's hooks are declined (#15304), so the pane's own transcript is the only
 * evidence of where the conversation went.
 */
export class ClaudeSessionContinuationTracker {
  /** Last scan per transcript, so an unchanged file is not re-read while its fork is pending. */
  private readonly scanByTranscript = new Map<
    string,
    { size: number; pointer?: string; jobShortId?: string }
  >()
  /** A session `/clear` started inside a job → that job's first session, which names its state dir. */
  private readonly jobSessionBySession = new Map<string, string>()

  resolve(session: AgentProviderSessionMetadata): AgentProviderSessionMetadata | null {
    const visited = new Set([session.id])
    let current = session
    for (let hop = 0; hop < MAX_CONTINUATION_HOPS; hop++) {
      const next = this.findNextSession(current)
      if (!next || visited.has(next.id)) {
        break
      }
      visited.add(next.id)
      current = next
    }
    return current === session ? null : current
  }

  private findNextSession(
    session: AgentProviderSessionMetadata
  ): AgentProviderSessionMetadata | null {
    const transcriptPath = session.transcriptPath
    if (session.key !== 'session_id' || !transcriptPath?.endsWith('.jsonl')) {
      return null
    }
    // Why before the size memo: after `/clear` the old transcript stops growing, so only the job's
    // state says where the conversation went.
    const jobSessionId = this.jobSessionBySession.get(session.id) ?? session.id
    const cleared = resolveClearedJobSession(transcriptPath, jobSessionId, session)
    if (cleared) {
      remember(this.jobSessionBySession, cleared.id, jobSessionId)
      return cleared
    }
    let size: number
    try {
      size = statSync(transcriptPath).size
    } catch {
      return null
    }
    const scan = this.scanByTranscript.get(transcriptPath)
    let pointer = scan?.pointer
    let jobShortId = scan?.jobShortId
    if (scan?.size !== size) {
      const isRescan = scan !== undefined && scan.size < size
      const found = readContinuationPointer(
        transcriptPath,
        session.id,
        isRescan ? size - scan.size + RESCAN_OVERLAP_BYTES : FIRST_SCAN_BYTES
      )
      // Why keep the old pointer on an empty rescan: only the appended bytes were read.
      pointer = found === undefined && isRescan ? scan.pointer : (found?.pointer ?? undefined)
      jobShortId = found === undefined && isRescan ? scan.jobShortId : found?.jobShortId
      remember(this.scanByTranscript, transcriptPath, { size, pointer, jobShortId })
    }
    // Why retry a remembered pointer: its fork may reach disk after the old file stops growing.
    const forked = pointer ? resolveForkedSession(transcriptPath, pointer, session.cwd) : null
    if (forked || !jobShortId) {
      return forked
    }
    // A dangling pointer still has the job Claude Code printed; its state names the live session.
    const attached = resolveAttachedJobSession(transcriptPath, jobShortId, session.cwd)
    if (attached && attached.session.id !== attached.jobSessionId) {
      remember(this.jobSessionBySession, attached.session.id, attached.jobSessionId)
    }
    return attached?.session ?? null
  }

  /** Whether this session runs as a Claude daemon job, whose hooks Orca declines (#15304). */
  isJobSession(session: Pick<AgentProviderSessionMetadata, 'id' | 'transcriptPath'>): boolean {
    const transcriptPath = session.transcriptPath
    if (!transcriptPath?.endsWith('.jsonl')) {
      return false
    }
    const jobSessionId = this.jobSessionBySession.get(session.id) ?? session.id
    const state = readJobState(transcriptPath, jobSessionId)
    return (
      state !== undefined && (jobSessionId === session.id || state.resumeSessionId === session.id)
    )
  }
}

function remember<V>(map: Map<string, V>, key: string, value: V): void {
  map.delete(key)
  map.set(key, value)
  while (map.size > MAX_REMEMBERED_ENTRIES) {
    const oldest = map.keys().next().value
    if (oldest === undefined) {
      break
    }
    map.delete(oldest)
  }
}

/** The fork a pane's Claude row should now point at. A fork another pane reports belongs to that
 *  pane, whose own hooks keep it current. */
export function resolvePaneClaudeContinuation(
  tracker: ClaudeSessionContinuationTracker,
  rows: ReadonlyMap<string, AgentHookEventPayload>,
  paneKey: string
): AgentProviderSessionMetadata | null {
  const row = rows.get(paneKey)
  if (
    !row?.providerSession ||
    row.payload.agentType !== 'claude' ||
    row.providerSessionOnly ||
    row.structuredHost
  ) {
    return null
  }
  const next = tracker.resolve(row.providerSession)
  if (!next) {
    return null
  }
  for (const [otherPaneKey, other] of rows) {
    if (otherPaneKey !== paneKey && other.providerSession?.id === next.id) {
      return null
    }
  }
  return next
}

/** The newest pointer out of `sessionId`, or null when a later turn continued this session
 *  instead (close to Claude Code's own reader); undefined when the scan saw neither. */
function readContinuationPointer(
  transcriptPath: string,
  sessionId: string,
  maxScanBytes: number
): ContinuationScan | undefined {
  return scanFileRegionsBackward<ContinuationScan>(
    transcriptPath,
    { chunkBytes: TRANSCRIPT_CHUNK_BYTES, maxScanBytes },
    (region) => {
      const lines = region.toString('utf8').split('\n')
      let found: ContinuationScan | undefined
      for (let index = lines.length - 1; index >= 0; index--) {
        const text = lines[index]
        if (
          !text.includes('"continued-in"') &&
          !text.includes('"local_command"') &&
          !text.includes('"type":"user"') &&
          !text.includes('"type":"assistant"')
        ) {
          continue
        }
        const record = parseRecord(text.trim())
        if (!record) {
          continue
        }
        if (
          record.type === 'continued-in' &&
          record.sessionId === sessionId &&
          isClaudeSessionId(record.continuedInSessionId)
        ) {
          if (found) {
            return found
          }
          // Keep reading: the command that wrote this pointer printed the job's id just before it.
          found = { pointer: record.continuedInSessionId }
          continue
        }
        const jobShortId = backgroundJobShortId(record, sessionId)
        if (jobShortId) {
          return { pointer: found?.pointer ?? null, jobShortId }
        }
        if (isCompletedTurn(record)) {
          return found ?? { pointer: null }
        }
      }
      return found
    }
  )
}

/** The job named by Claude Code's own `/resume` or `/fork` output, recorded as a local command. */
function backgroundJobShortId(
  record: Record<string, unknown>,
  sessionId: string
): string | undefined {
  if (
    record.type !== 'system' ||
    record.subtype !== 'local_command' ||
    record.sessionId !== sessionId ||
    typeof record.content !== 'string'
  ) {
    return undefined
  }
  return BACKGROUND_JOB_OUTPUT.exec(record.content)?.[1]
}

/** A real prompt or a finished, non-error reply: the old session went on after any older pointer. */
function isCompletedTurn(record: Record<string, unknown>): boolean {
  const message = record.message
  const fields =
    typeof message === 'object' && message !== null && !Array.isArray(message)
      ? Object.fromEntries(Object.entries(message))
      : {}
  if (record.type === 'assistant') {
    return record.isApiErrorMessage !== true && typeof fields.stop_reason === 'string'
  }
  if (record.type !== 'user' || record.isMeta === true || record.isCompactSummary === true) {
    return false
  }
  const content: unknown = fields.content
  const texts: unknown[] = typeof content === 'string' ? [content] : []
  if (Array.isArray(content)) {
    if (content.some((block) => block?.type === 'tool_result')) {
      return false
    }
    texts.push(...content.filter((block) => block?.type === 'text').map((block) => block.text))
  }
  return texts.some(
    (text) => typeof text === 'string' && text.trim() !== '' && !NOT_A_PROMPT.test(text)
  )
}
