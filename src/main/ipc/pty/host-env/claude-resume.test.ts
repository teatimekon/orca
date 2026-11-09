import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../../../shared/setup-agent-sequencing'
import { resolveClaudeSavedResumeLaunch, type ClaudeResumeLaunchArgs } from './claude-resume'

const SAVED = '11111111-1111-4111-8111-111111111111'
const CONTINUED = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'

let configDir: string
let projectDir: string

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'claude-saved-resume-'))
  projectDir = join(configDir, 'projects', '-work-repo')
  mkdirSync(projectDir, { recursive: true })
})

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true })
})

function conversation(id: string): string {
  const transcriptPath = join(projectDir, `${id}.jsonl`)
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({ type: 'user', sessionId: id, entrypoint: 'cli' })}\n`
  )
  return transcriptPath
}

/** The state Claude keeps for a daemon job that took this pane's conversation. */
function jobContinuedInto(id: string): string {
  const linkScanPath = conversation(id)
  const jobDir = join(configDir, 'jobs', SAVED.slice(0, 8))
  mkdirSync(jobDir, { recursive: true })
  writeFileSync(
    join(jobDir, 'state.json'),
    JSON.stringify({ sessionId: SAVED, resumeSessionId: id, linkScanPath })
  )
  return linkScanPath
}

function savedLaunch(overrides: Partial<ClaudeResumeLaunchArgs> = {}): ClaudeResumeLaunchArgs {
  const command = `claude '--plugin-dir' '/orca/agent-view' '--effort' 'max' '--resume' '${SAVED}'`
  return {
    launchAgent: 'claude',
    command,
    env: { [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: command, KEEP: '1' },
    providerSession: {
      key: 'session_id',
      id: SAVED,
      transcriptPath: join(projectDir, `${SAVED}.jsonl`),
      cwd: '/work/repo',
      effort: 'max'
    },
    resumeOrigin: 'saved',
    local: true,
    ...overrides
  }
}

describe('resolveClaudeSavedResumeLaunch', () => {
  it('resumes the conversation the saved session continued into as a daemon job', () => {
    const transcriptPath = jobContinuedInto(CONTINUED)

    const launch = resolveClaudeSavedResumeLaunch(savedLaunch())

    const expectedCommand = `claude '--plugin-dir' '/orca/agent-view' '--effort' 'max' '--resume' '${CONTINUED}'`
    expect(launch).toEqual({
      command: expectedCommand,
      env: { [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: expectedCommand, KEEP: '1' },
      providerSession: {
        key: 'session_id',
        id: CONTINUED,
        transcriptPath,
        cwd: '/work/repo',
        effort: 'max'
      },
      droppedResumeArgv: false
    })
  })

  it('launches Claude without --resume when nothing continued the saved session', () => {
    conversation(OTHER)

    const launch = resolveClaudeSavedResumeLaunch(savedLaunch())

    expect(launch?.command).toBe(`claude '--plugin-dir' '/orca/agent-view' '--effort' 'max'`)
    expect(launch?.env?.[SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]).toBe(launch?.command)
    expect(launch?.droppedResumeArgv).toBe(true)
    expect(launch?.providerSession.id).toBe(SAVED)
  })

  it('leaves a resume alone when its transcript exists, the user picked it, or it runs elsewhere', () => {
    jobContinuedInto(CONTINUED)

    expect(resolveClaudeSavedResumeLaunch(savedLaunch({ resumeOrigin: undefined }))).toBeNull()
    expect(resolveClaudeSavedResumeLaunch(savedLaunch({ local: false }))).toBeNull()
    conversation(SAVED)
    expect(resolveClaudeSavedResumeLaunch(savedLaunch())).toBeNull()
  })
})
