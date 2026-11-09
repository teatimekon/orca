import { statSync } from 'node:fs'
import path from 'node:path'
import type { AgentProviderSessionMetadata } from '../agent-session/lifecycle/agent-session-resume'
import {
  isClaudeSessionId,
  isFile,
  resolveAttachedJobSession,
  transcriptHeadNamesSession
} from './claude-session-continuation-jobs'

export type ClaudeResumeTarget =
  | { kind: 'keep' }
  | {
      kind: 'substitute'
      session: AgentProviderSessionMetadata
      via: 'transcript' | 'job'
    }
  | { kind: 'fresh' }

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
 * conversation moved into a daemon job, names an id that resumes nothing. Layers, in order: the
 * id's own transcript; the transcript the hook named; the daemon job that id ran as; otherwise
 * `fresh`, because guessing another conversation in a shared folder is worse than starting anew.
 */
export function resolveClaudeResumeTarget(
  session: AgentProviderSessionMetadata
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
  const named = claudeSessionNamedByTranscript(session)
  if (named) {
    return { kind: 'substitute', session: named, via: 'transcript' }
  }
  const job = resolveAttachedJobSession(transcriptPath, session.id.slice(0, 8), session.cwd)
  if (job?.jobSessionId === session.id) {
    const resumed = session.effort ? { ...job.session, effort: session.effort } : job.session
    return { kind: 'substitute', session: resumed, via: 'job' }
  }
  return { kind: 'fresh' }
}

function isDirectory(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}
