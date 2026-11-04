import { statSync } from 'node:fs'
import type { AgentHookEventPayload } from '../../../shared/agent-hook-listener/listener-event'
import {
  readClaudeTranscriptTurnState,
  type ClaudeTranscriptTurnState
} from '../../../shared/agent-hook-listener/claude-transcript-turn-state'
import type { ParsedAgentStatusPayload } from '../../../shared/agent-status-types'
import { AgentHookServerAgentPresence } from './server-agent-presence'

const CLAUDE_JOB_FOLLOW_INTERVAL_MS = 1500

/** The row's payload after the job's transcript spoke; undefined when nothing it says is new. */
export function claudeJobTurnPayload(
  row: AgentHookEventPayload,
  turn: ClaudeTranscriptTurnState,
  now: number
): ParsedAgentStatusPayload | undefined {
  const current = row.payload
  const prompt = turn.prompt ?? current.prompt
  const lastAssistantMessage =
    turn.state === 'done' ? (turn.lastAssistantMessage ?? current.lastAssistantMessage) : undefined
  const interrupted = turn.state === 'done' ? turn.interrupted : undefined
  if (
    current.state === turn.state &&
    current.prompt === prompt &&
    current.lastAssistantMessage === lastAssistantMessage &&
    current.interrupted === interrupted
  ) {
    return undefined
  }
  const {
    lastAssistantMessage: _message,
    lastAssistantMessageIsToolOutput: _toolOutput,
    interrupted: _interrupted,
    turnCompletedAt,
    toolName: _toolName,
    toolInput: _toolInput,
    interactivePrompt: _interactivePrompt,
    ...rest
  } = current
  return {
    ...rest,
    state: turn.state,
    prompt,
    ...(lastAssistantMessage !== undefined ? { lastAssistantMessage } : {}),
    ...(interrupted ? { interrupted } : {}),
    ...(turn.state === 'done'
      ? { turnCompletedAt: current.state === 'done' ? turnCompletedAt : now }
      : {})
  }
}

/**
 * A Claude pane continued into a daemon job (`/fork`, `/resume` onto a background session) gets
 * no hooks from that job (#15304), so its row would freeze at the last state the pane's own
 * process reported. The job's transcript still records every turn; follow it.
 */
export abstract class AgentHookServerClaudeJobFollower extends AgentHookServerAgentPresence {
  private claudeJobFollowTimer: ReturnType<typeof setInterval> | null = null
  /** Last transcript size applied per pane and session, so an unchanged file is not re-read. */
  private readonly claudeJobTranscriptSizes = new Map<string, number>()

  protected startClaudeJobFollower(): void {
    if (this.claudeJobFollowTimer) {
      return
    }
    this.claudeJobFollowTimer = setInterval(() => {
      this.followClaudeJobsOnce()
    }, CLAUDE_JOB_FOLLOW_INTERVAL_MS)
    if (this.claudeJobFollowTimer.unref) {
      this.claudeJobFollowTimer.unref()
    }
  }

  protected stopClaudeJobFollower(): void {
    if (this.claudeJobFollowTimer) {
      clearInterval(this.claudeJobFollowTimer)
      this.claudeJobFollowTimer = null
    }
    this.claudeJobTranscriptSizes.clear()
  }

  /** One sweep over local Claude rows; returns how many rows the job transcripts changed. */
  followClaudeJobsOnce(): number {
    let updated = 0
    const now = Date.now()
    for (const [paneKey, row] of this.state.lastStatusByPaneKey) {
      if (
        row.payload.agentType !== 'claude' ||
        row.connectionId !== null ||
        row.structuredHost ||
        row.providerSessionOnly ||
        row.agentPresence?.ended
      ) {
        continue
      }
      // The pane's own transcript may only now name the job it continued into.
      this.followClaudeSessionContinuation(paneKey)
      const current = this.state.lastStatusByPaneKey.get(paneKey)
      const session = current?.providerSession
      if (!current || !session?.transcriptPath || !this.claudeContinuations.isJobSession(session)) {
        continue
      }
      let size: number
      try {
        size = statSync(session.transcriptPath).size
      } catch {
        continue
      }
      const sizeKey = `${paneKey}\0${session.id}`
      if (this.claudeJobTranscriptSizes.get(sizeKey) === size) {
        continue
      }
      this.claudeJobTranscriptSizes.set(sizeKey, size)
      const turn = readClaudeTranscriptTurnState(session.transcriptPath)
      const payload = turn ? claudeJobTurnPayload(current, turn, now) : undefined
      if (!payload) {
        continue
      }
      this.applyNormalizedStatus(
        {
          ...current,
          isReplay: undefined,
          hookEventName: undefined,
          hasExplicitPrompt: undefined,
          payload
        },
        undefined,
        'process'
      )
      updated += 1
    }
    return updated
  }
}
