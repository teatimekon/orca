import { describe, expect, it } from 'vitest'
import { getAgentForkArgv, getAgentResumeArgv } from './agent-resume-argv'

describe('getAgentForkArgv', () => {
  it('forks a Claude conversation into a new session id', () => {
    expect(getAgentForkArgv('claude', { key: 'session_id', id: 'sess-1' })).toEqual([
      'claude',
      '--resume',
      'sess-1',
      '--fork-session'
    ])
  })

  it('replays the live effort level like a plain resume', () => {
    const session = { key: 'session_id', id: 'sess-1', effort: 'max' } as const
    expect(getAgentForkArgv('claude', session)).toEqual([
      'claude',
      '--effort',
      'max',
      '--resume',
      'sess-1',
      '--fork-session'
    ])
    expect(getAgentResumeArgv('claude', session)).toEqual([
      'claude',
      '--effort',
      'max',
      '--resume',
      'sess-1'
    ])
  })

  it('refuses agents that cannot fork a conversation', () => {
    expect(getAgentForkArgv('dsh', { key: 'session_id', id: 'sess-1' })).toBeNull()
  })
})
