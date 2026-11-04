import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readClaudeTranscriptTurnState } from './claude-transcript-turn-state'

const SESSION = '22222222-2222-4222-8222-222222222222'
const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function line(record: Record<string, unknown>): string {
  return `${JSON.stringify(record)}\n`
}

function prompt(text: string): string {
  return line({ type: 'user', sessionId: SESSION, message: { role: 'user', content: text } })
}

function toolResult(): string {
  return line({
    type: 'user',
    sessionId: SESSION,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }]
    }
  })
}

function toolCall(): string {
  return line({
    type: 'assistant',
    sessionId: SESSION,
    message: {
      role: 'assistant',
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: 'Looking…' },
        { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls' } }
      ]
    }
  })
}

function reply(text: string): string {
  return line({
    type: 'assistant',
    sessionId: SESSION,
    message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text }] }
  })
}

function blob(): string {
  return line({
    type: 'api-request-blob',
    sessionId: SESSION,
    message: { role: 'user', content: [{ type: 'text', text: 'not a turn record' }] }
  })
}

function transcript(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'claude-turn-state-'))
  dirs.push(dir)
  const path = join(dir, `${SESSION}.jsonl`)
  writeFileSync(path, body)
  return path
}

describe('readClaudeTranscriptTurnState', () => {
  it('is working with the prompt while the newest record is the user prompt', () => {
    expect(readClaudeTranscriptTurnState(transcript(prompt('fix the tests')))).toEqual({
      state: 'working',
      prompt: 'fix the tests'
    })
  })

  it('stays working through tool calls and tool results', () => {
    expect(readClaudeTranscriptTurnState(transcript(prompt('go') + toolCall()))).toEqual({
      state: 'working',
      prompt: 'go'
    })
    expect(
      readClaudeTranscriptTurnState(transcript(prompt('go') + toolCall() + toolResult() + blob()))
    ).toEqual({ state: 'working', prompt: 'go' })
  })

  it('is done with the reply once the assistant ends the turn', () => {
    expect(
      readClaudeTranscriptTurnState(
        transcript(prompt('go') + toolCall() + toolResult() + reply('All done.'))
      )
    ).toEqual({ state: 'done', prompt: 'go', lastAssistantMessage: 'All done.' })
  })

  it('treats an interrupt marker as the end of the turn', () => {
    expect(
      readClaudeTranscriptTurnState(
        transcript(prompt('go') + toolCall() + prompt('[Request interrupted by user]'))
      )
    ).toEqual({ state: 'done', interrupted: true, prompt: 'go' })
  })

  it('skips tagged text, meta records and command output when naming the prompt', () => {
    const body =
      prompt('real question') +
      line({
        type: 'user',
        isMeta: true,
        sessionId: SESSION,
        message: { role: 'user', content: 'meta note' }
      }) +
      prompt('<command-name>/compact</command-name>') +
      reply('Answer.')
    expect(readClaudeTranscriptTurnState(transcript(body))).toEqual({
      state: 'done',
      prompt: 'real question',
      lastAssistantMessage: 'Answer.'
    })
  })

  it('reports an API error reply as a finished turn', () => {
    const body =
      prompt('go') +
      line({
        type: 'assistant',
        isApiErrorMessage: true,
        sessionId: SESSION,
        message: { role: 'assistant', content: [{ type: 'text', text: 'Rate limited' }] }
      })
    expect(readClaudeTranscriptTurnState(transcript(body))).toEqual({
      state: 'done',
      prompt: 'go',
      lastAssistantMessage: 'Rate limited'
    })
  })

  it('returns nothing for an empty or missing transcript', () => {
    expect(readClaudeTranscriptTurnState(transcript(''))).toBeUndefined()
    expect(readClaudeTranscriptTurnState(join(tmpdir(), 'nope', 'missing.jsonl'))).toBeUndefined()
  })
})
