import { readdirSync, statSync, type Dirent } from 'node:fs'
import path from 'node:path'
import {
  normalizeAgentProviderSession,
  type AgentProviderSessionMetadata
} from '../agent-session/lifecycle/agent-session-resume'
import {
  isClaudeSessionId,
  isFile,
  readTranscriptHead,
  resolveAttachedJobSession,
  transcriptHeadNamesSession
} from './claude-session-continuation-jobs'

const NEWEST_CONVERSATION_CANDIDATES = 16
// `claude -p` and SDK hosts stamp sdk-* entrypoints; those runs are automation, not a pane's chat.
const AUTOMATION_ENTRYPOINT = '"entrypoint":"sdk-'

export type ClaudeResumeTarget =
  | { kind: 'keep' }
  | {
      kind: 'substitute'
      session: AgentProviderSessionMetadata
      via: 'transcript' | 'job' | 'newest'
    }
  | { kind: 'fresh' }

export type ClaudeResumeTargetOptions = {
  /** Sessions other panes hold; resuming one here would give that conversation two writers. */
  heldSessionIds: ReadonlySet<string>
  /** When this pane's session began (epoch ms). The newest-conversation fallback skips
   *  conversations last written before it, and is skipped entirely without it. */
  notBefore?: number
}

/**
 * The conversation the hook's own transcript file holds, when Claude reported a session_id under
 * which nothing was written. `claude --resume` finds conversations by their file's id.
 */
export function claudeSessionNamedByTranscript(
  session: AgentProviderSessionMetadata
): AgentProviderSessionMetadata | null {
  const transcriptPath = session.transcriptPath
  if (session.key !== 'session_id' || !transcriptPath?.endsWith('.jsonl')) {
    return null
  }
  const fileId = path.basename(transcriptPath, '.jsonl')
  if (
    fileId === session.id ||
    !isClaudeSessionId(fileId) ||
    isFile(path.join(path.dirname(transcriptPath), `${session.id}.jsonl`)) ||
    !transcriptHeadNamesSession(transcriptPath, fileId)
  ) {
    return null
  }
  return { ...session, id: fileId }
}

/**
 * Where `claude --resume` can pick up a pane's conversation. Claude writes a transcript only once
 * a session gets its first message, so a pane left idle after a fresh start or a fork, or one whose
 * conversation moved into a daemon job, names an id that resumes nothing. Layers, in order:
 * the id's own transcript; the transcript the hook named; the daemon job that id ran as; the
 * newest unheld conversation in the project folder since the pane began; otherwise `fresh`.
 */
export function resolveClaudeResumeTarget(
  session: AgentProviderSessionMetadata,
  readOptions: () => ClaudeResumeTargetOptions
): ClaudeResumeTarget {
  const transcriptPath = session.transcriptPath
  if (
    session.key !== 'session_id' ||
    !isClaudeSessionId(session.id) ||
    !transcriptPath?.endsWith('.jsonl') ||
    !path.isAbsolute(transcriptPath)
  ) {
    return { kind: 'keep' }
  }
  const projectDir = path.dirname(transcriptPath)
  // Why: an unreadable projects root (another machine's path, an unmounted volume) proves nothing
  // is missing, while a readable one without this folder means Claude never wrote here.
  if (
    !isDirectory(path.dirname(projectDir)) ||
    isFile(path.join(projectDir, `${session.id}.jsonl`))
  ) {
    return { kind: 'keep' }
  }
  // Read only once the transcript is missing: callers gather these from every pane's status.
  const options = readOptions()
  const unheld = (candidate: AgentProviderSessionMetadata | null) =>
    candidate && !options.heldSessionIds.has(candidate.id) ? candidate : null
  const named = unheld(claudeSessionNamedByTranscript(session))
  if (named) {
    return { kind: 'substitute', session: named, via: 'transcript' }
  }
  const job = resolveAttachedJobSession(transcriptPath, session.id.slice(0, 8), session.cwd)
  const jobSession =
    job?.jobSessionId === session.id ? unheld(withEffort(job.session, session)) : null
  if (jobSession) {
    return { kind: 'substitute', session: jobSession, via: 'job' }
  }
  const newest =
    options.notBefore === undefined
      ? null
      : newestConversation(projectDir, session, options.heldSessionIds, options.notBefore)
  return newest ? { kind: 'substitute', session: newest, via: 'newest' } : { kind: 'fresh' }
}

function newestConversation(
  projectDir: string,
  session: AgentProviderSessionMetadata,
  heldSessionIds: ReadonlySet<string>,
  notBefore: number
): AgentProviderSessionMetadata | null {
  let entries: Dirent[]
  try {
    entries = readdirSync(projectDir, { withFileTypes: true })
  } catch {
    return null
  }
  const candidates: { id: string; filePath: string; mtimeMs: number }[] = []
  for (const entry of entries) {
    const id = entry.name.endsWith('.jsonl') ? entry.name.slice(0, -'.jsonl'.length) : ''
    if (!entry.isFile() || id === session.id || !isClaudeSessionId(id) || heldSessionIds.has(id)) {
      continue
    }
    const filePath = path.join(projectDir, entry.name)
    const mtimeMs = modifiedAt(filePath)
    if (mtimeMs !== undefined && mtimeMs >= notBefore) {
      candidates.push({ id, filePath, mtimeMs })
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  // Subagent transcripts live in <session>/subagents/, so only top-level conversations are listed.
  const found = candidates.slice(0, NEWEST_CONVERSATION_CANDIDATES).find((candidate) => {
    const head = readTranscriptHead(candidate.filePath)
    return (
      head?.includes(`"sessionId":"${candidate.id}"`) === true &&
      !head.includes(AUTOMATION_ENTRYPOINT)
    )
  })
  return found
    ? withEffort(
        normalizeAgentProviderSession({
          key: 'session_id',
          id: found.id,
          transcriptPath: found.filePath,
          cwd: session.cwd
        }),
        session
      )
    : null
}

function withEffort(
  candidate: AgentProviderSessionMetadata | null,
  session: AgentProviderSessionMetadata
): AgentProviderSessionMetadata | null {
  return candidate && session.effort ? { ...candidate, effort: session.effort } : candidate
}

function modifiedAt(filePath: string): number | undefined {
  try {
    return statSync(filePath).mtimeMs
  } catch {
    return undefined
  }
}

function isDirectory(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}
