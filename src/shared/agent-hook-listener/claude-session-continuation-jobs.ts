import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  normalizeAgentProviderSession,
  type AgentProviderSessionMetadata
} from '../agent-session/lifecycle/agent-session-resume'

const FORK_HEAD_SCAN_BYTES = 256 * 1024
const CLAUDE_SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseRecord(line: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(line)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : undefined
  } catch {
    return undefined
  }
}

export function isClaudeSessionId(value: unknown): value is string {
  return typeof value === 'string' && CLAUDE_SESSION_ID.test(value)
}

export function resolveForkedSession(
  transcriptPath: string,
  forkedSessionId: string,
  cwd: string | undefined
): AgentProviderSessionMetadata | null {
  const forkedPath = findForkedTranscript(transcriptPath, forkedSessionId)
  if (!forkedPath || !transcriptHeadNamesSession(forkedPath, forkedSessionId)) {
    return null
  }
  return normalizeAgentProviderSession({
    key: 'session_id',
    id: forkedSessionId,
    transcriptPath: forkedPath,
    cwd
  })
}

/** The session a job runs now: its state's current session, whose transcript sits beside the old one. */
export function resolveAttachedJobSession(
  transcriptPath: string,
  jobShortId: string,
  cwd: string | undefined
): { session: AgentProviderSessionMetadata; jobSessionId: string } | null {
  const state = readJobStateByShortId(transcriptPath, jobShortId)
  const jobSessionId = state?.sessionId
  if (!state || !isClaudeSessionId(jobSessionId) || !jobSessionId.startsWith(jobShortId)) {
    return null
  }
  const currentId = isClaudeSessionId(state.resumeSessionId) ? state.resumeSessionId : jobSessionId
  const forkedPath = isSiblingFile(transcriptPath, state.linkScanPath)
    ? state.linkScanPath
    : path.join(path.dirname(transcriptPath), `${currentId}.jsonl`)
  if (!isFile(forkedPath) || !transcriptHeadNamesSession(forkedPath, currentId)) {
    return null
  }
  const session = normalizeAgentProviderSession({
    key: 'session_id',
    id: currentId,
    transcriptPath: forkedPath,
    cwd
  })
  return session ? { session, jobSessionId } : null
}

/** The fork lives beside the old transcript; the job's state names it when the file is not `<id>.jsonl`. */
function findForkedTranscript(transcriptPath: string, sessionId: string): string | undefined {
  const byId = path.join(path.dirname(transcriptPath), `${sessionId}.jsonl`)
  if (isFile(byId)) {
    return byId
  }
  const state = readJobState(transcriptPath, sessionId)
  return state && isSiblingFile(transcriptPath, state.linkScanPath) ? state.linkScanPath : undefined
}

/** `/clear` inside a job starts a new transcript without writing `continued-in`; the job's state
 *  keeps its first session id and names the current one as `resumeSessionId`. */
export function resolveClearedJobSession(
  transcriptPath: string,
  jobSessionId: string,
  session: AgentProviderSessionMetadata
): AgentProviderSessionMetadata | null {
  const state = readJobState(transcriptPath, jobSessionId)
  if (
    !state ||
    !isClaudeSessionId(state.resumeSessionId) ||
    state.resumeSessionId === session.id ||
    !isSiblingFile(transcriptPath, state.linkScanPath) ||
    !transcriptHeadNamesSession(state.linkScanPath, state.resumeSessionId)
  ) {
    return null
  }
  return normalizeAgentProviderSession({
    key: 'session_id',
    id: state.resumeSessionId,
    transcriptPath: state.linkScanPath,
    cwd: session.cwd
  })
}

type JobState = { sessionId: unknown; linkScanPath: unknown; resumeSessionId: unknown }

/** <config>/projects/<cwd slug>/<id>.jsonl → <config>/jobs/<first 8 of id>/state.json, when it is this session's job. */
export function readJobState(transcriptPath: string, sessionId: string): JobState | undefined {
  if (!isClaudeSessionId(sessionId)) {
    return undefined
  }
  const state = readJobStateByShortId(transcriptPath, sessionId.slice(0, 8))
  return state?.sessionId === sessionId ? state : undefined
}

/** <config>/jobs/<short id>/state.json beside the transcript's config dir, parsed but unchecked. */
function readJobStateByShortId(transcriptPath: string, jobShortId: string): JobState | undefined {
  const configDir = path.dirname(path.dirname(path.dirname(transcriptPath)))
  const statePath = path.join(configDir, 'jobs', jobShortId, 'state.json')
  let state: Record<string, unknown> | undefined
  try {
    state = parseRecord(readFileSync(statePath, 'utf8'))
  } catch {
    return undefined
  }
  return state
    ? {
        sessionId: state.sessionId,
        linkScanPath: state.linkScanPath,
        resumeSessionId: state.resumeSessionId
      }
    : undefined
}

function isSiblingFile(transcriptPath: string, candidate: unknown): candidate is string {
  return (
    typeof candidate === 'string' &&
    path.dirname(candidate) === path.dirname(transcriptPath) &&
    isClaudeSessionId(path.basename(candidate, '.jsonl')) &&
    path.extname(candidate) === '.jsonl' &&
    isFile(candidate)
  )
}

export function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

/** The first bytes of a transcript, enough for the records that name its session. */
export function readTranscriptHead(transcriptPath: string): string | undefined {
  try {
    const fd = openSync(transcriptPath, 'r')
    try {
      const buffer = Buffer.alloc(FORK_HEAD_SCAN_BYTES)
      const read = readSync(fd, buffer, 0, FORK_HEAD_SCAN_BYTES, 0)
      return buffer.subarray(0, read).toString('utf8')
    } finally {
      closeSync(fd)
    }
  } catch {
    return undefined
  }
}

/** The transcript's own records must carry this id; a stray file under that name proves nothing. */
export function transcriptHeadNamesSession(transcriptPath: string, sessionId: string): boolean {
  // Why a substring: a huge first record would not parse inside the head window.
  return readTranscriptHead(transcriptPath)?.includes(`"sessionId":"${sessionId}"`) === true
}
