import {
  normalizeAgentProviderSession,
  type AgentProviderSessionMetadata
} from '../../../../shared/agent-session/lifecycle/agent-session-resume'
import { resolveClaudeResumeTarget } from '../../../../shared/agent-hook-listener/claude-resume-target'
import { retargetClaudeResumeInCommand } from '../../../../shared/agent-resume-argv-drop'
import { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../../../shared/setup-agent-sequencing'
import type { TuiAgent } from '../../../../shared/tui-agent'

export type ClaudeResumeLaunch = {
  command: string
  env: Record<string, string> | undefined
  /** The session the launch now resumes; the saved one when the resume was dropped. */
  providerSession: AgentProviderSessionMetadata
  droppedResumeArgv: boolean
}

export type ClaudeResumeLaunchArgs = {
  launchAgent: TuiAgent | undefined
  command: string | undefined
  env: Record<string, string> | undefined
  providerSession: AgentProviderSessionMetadata | undefined
  /** Only resumes rebuilt from a pane's saved facts are checked; a user's pick stays as asked. */
  resumeOrigin: unknown
  /** Transcripts are read from this machine's disk; SSH and WSL agents keep theirs elsewhere. */
  local: boolean
}

/**
 * A saved Claude resume whose id has no transcript fails with "No conversation found"; point it
 * at where the conversation went, or start Claude without `--resume`. Null keeps the launch as is.
 */
export function resolveClaudeSavedResumeLaunch(
  args: ClaudeResumeLaunchArgs
): ClaudeResumeLaunch | null {
  const session = normalizeAgentProviderSession(args.providerSession)
  if (
    args.launchAgent !== 'claude' ||
    args.resumeOrigin !== 'saved' ||
    !args.local ||
    !args.command ||
    !session
  ) {
    return null
  }
  const target = resolveClaudeResumeTarget(session)
  if (target.kind === 'keep') {
    return null
  }
  const toId = target.kind === 'substitute' ? target.session.id : null
  const command = retargetClaudeResumeInCommand(args.command, session.id, toId)
  if (command === null) {
    console.warn(
      `[claude-resume] ${session.id} has no transcript, but its launch has no --resume to fix`
    )
    return null
  }
  const sequenced = args.env?.[SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]
  const sequencedCommand = sequenced
    ? retargetClaudeResumeInCommand(sequenced, session.id, toId)
    : null
  console.warn(
    target.kind === 'substitute'
      ? `[claude-resume] ${session.id} has no transcript; resuming ${target.session.id} (${target.via}) instead`
      : `[claude-resume] ${session.id} has no transcript and nothing continued it; starting Claude fresh`
  )
  return {
    command,
    env:
      args.env && sequencedCommand !== null
        ? { ...args.env, [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: sequencedCommand }
        : args.env,
    providerSession: target.kind === 'substitute' ? target.session : session,
    droppedResumeArgv: target.kind === 'fresh'
  }
}
