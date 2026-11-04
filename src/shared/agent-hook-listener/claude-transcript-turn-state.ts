import { scanFileRegionsBackward } from './reverse-file-region-scan'
import { TRANSCRIPT_CHUNK_BYTES, TRANSCRIPT_MAX_SCAN_BYTES } from './transcript-reader'

export type ClaudeTranscriptTurnState = {
  state: 'working' | 'done'
  /** The newest real prompt in the scanned window, when one was seen. */
  prompt?: string
  /** The reply that ended the turn; absent while the turn runs. */
  lastAssistantMessage?: string
  interrupted?: boolean
}

// Claude Code skips tagged text (commands, reminders) and interrupt markers when finding prompts.
const TAGGED_TEXT = /^\s*<[a-z][\w-]*[\s>]/
const INTERRUPTED = /^\[Request interrupted by user/

type JsonRecord = Record<string, unknown>

function parseRecord(line: string): JsonRecord | undefined {
  try {
    const parsed: unknown = JSON.parse(line)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : undefined
  } catch {
    return undefined
  }
}

function messageOf(record: JsonRecord): JsonRecord {
  const message = record.message
  return typeof message === 'object' && message !== null && !Array.isArray(message)
    ? (message as JsonRecord)
    : {}
}

function contentBlocks(message: JsonRecord): JsonRecord[] {
  return Array.isArray(message.content)
    ? message.content.filter(
        (block): block is JsonRecord => typeof block === 'object' && block !== null
      )
    : []
}

function textOf(message: JsonRecord): string {
  if (typeof message.content === 'string') {
    return message.content
  }
  return contentBlocks(message)
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
    .trim()
}

type Verdict = { state: 'working' | 'done'; lastAssistantMessage?: string; interrupted?: boolean }

/** What an assistant record says about the turn; a reply that still calls tools keeps it running. */
function assistantVerdict(record: JsonRecord): Verdict {
  const message = messageOf(record)
  if (record.isApiErrorMessage === true) {
    return { state: 'done', lastAssistantMessage: textOf(message) }
  }
  const callsTools = contentBlocks(message).some((block) => block.type === 'tool_use')
  if (callsTools || message.stop_reason === 'tool_use' || typeof message.stop_reason !== 'string') {
    return { state: 'working' }
  }
  return { state: 'done', lastAssistantMessage: textOf(message) }
}

/** What a user record says: tool results and prompts keep the agent working; an interrupt ends it. */
function userVerdict(record: JsonRecord): (Verdict & { prompt?: string }) | undefined {
  if (record.isMeta === true || record.isCompactSummary === true) {
    return undefined
  }
  const message = messageOf(record)
  if (contentBlocks(message).some((block) => block.type === 'tool_result')) {
    return { state: 'working' }
  }
  const text = textOf(message)
  if (!text) {
    return undefined
  }
  if (INTERRUPTED.test(text)) {
    return { state: 'done', interrupted: true }
  }
  if (TAGGED_TEXT.test(text)) {
    return undefined
  }
  return { state: 'working', prompt: text }
}

/**
 * The turn state a Claude transcript's newest records imply. Daemon jobs decline Orca's hooks
 * (#15304), so a pane attached to one has only this file to say whether its agent still works.
 */
export function readClaudeTranscriptTurnState(
  transcriptPath: string
): ClaudeTranscriptTurnState | undefined {
  return scanFileRegionsBackward<ClaudeTranscriptTurnState>(
    transcriptPath,
    { chunkBytes: TRANSCRIPT_CHUNK_BYTES, maxScanBytes: TRANSCRIPT_MAX_SCAN_BYTES },
    (region) => {
      const lines = region.toString('utf8').split('\n')
      let verdict: Verdict | undefined
      for (let index = lines.length - 1; index >= 0; index--) {
        const text = lines[index]
        if (!text.includes('"type":"user"') && !text.includes('"type":"assistant"')) {
          continue
        }
        const record = parseRecord(text.trim())
        if (!record) {
          continue
        }
        if (record.type === 'assistant') {
          verdict ??= assistantVerdict(record)
          continue
        }
        if (record.type !== 'user') {
          continue
        }
        const user = userVerdict(record)
        if (!user) {
          continue
        }
        if (!verdict) {
          verdict = user
        }
        // The newest real prompt labels the row even when a later record decided the state.
        if (user.prompt !== undefined) {
          return { ...verdict, prompt: user.prompt }
        }
      }
      return verdict
    }
  )
}
