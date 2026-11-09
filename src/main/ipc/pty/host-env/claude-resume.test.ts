import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusIpcPayload } from '../../../../shared/agent-status-types'
import { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../../../shared/setup-agent-sequencing'
import { resolveClaudeSavedResumeLaunch, type ClaudeResumeLaunchArgs } from './claude-resume'

const rows = vi.hoisted(() => ({ current: [] as AgentStatusIpcPayload[] }))
vi.mock('../../../agent-hooks/server', () => ({
  agentHookServer: { getStatusSnapshot: () => rows.current }
}))

const SAVED = '11111111-1111-4111-8111-111111111111'
const CONTINUED = '22222222-2222-4222-8222-222222222222'
const OTHER_PANES = '33333333-3333-4333-8333-333333333333'
const PANE = 'tab-1:leaf-1'
const PANE_STARTED = 1_800_000_000_000

let projectDir: string

beforeEach(() => {
  projectDir = join(mkdtempSync(join(tmpdir(), 'claude-saved-resume-')), 'projects', '-work-repo')
  mkdirSync(projectDir, { recursive: true })
})

afterEach(() => {
  rmSync(join(projectDir, '..', '..'), { recursive: true, force: true })
  rows.current = []
})

function conversation(id: string, modifiedAt: number): void {
  const transcriptPath = join(projectDir, `${id}.jsonl`)
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({ type: 'user', sessionId: id, entrypoint: 'cli' })}\n`
  )
  utimesSync(transcriptPath, modifiedAt / 1000, modifiedAt / 1000)
}

function row(paneKey: string, id: string): AgentStatusIpcPayload {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the launch reads only these fields of a status row.
  return {
    paneKey,
    stateStartedAt: PANE_STARTED,
    providerSession: { key: 'session_id', id, transcriptPath: join(projectDir, `${id}.jsonl`) }
  } as AgentStatusIpcPayload
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
    paneKey: PANE,
    local: true,
    ...overrides
  }
}

describe('resolveClaudeSavedResumeLaunch', () => {
  it('resumes the newest conversation since the pane began that no other pane holds', () => {
    conversation(CONTINUED, PANE_STARTED + 1_000)
    conversation(OTHER_PANES, PANE_STARTED + 2_000)
    rows.current = [row(PANE, SAVED), row('tab-2:leaf-1', OTHER_PANES)]

    const launch = resolveClaudeSavedResumeLaunch(savedLaunch())

    const expectedCommand = `claude '--plugin-dir' '/orca/agent-view' '--effort' 'max' '--resume' '${CONTINUED}'`
    expect(launch).toEqual({
      command: expectedCommand,
      env: { [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: expectedCommand, KEEP: '1' },
      providerSession: {
        key: 'session_id',
        id: CONTINUED,
        transcriptPath: join(projectDir, `${CONTINUED}.jsonl`),
        cwd: '/work/repo',
        effort: 'max'
      },
      droppedResumeArgv: false
    })
  })

  it('launches Claude without --resume when nothing continued the saved session', () => {
    conversation(OTHER_PANES, PANE_STARTED + 2_000)
    rows.current = [row(PANE, SAVED), row('tab-2:leaf-1', OTHER_PANES)]

    const launch = resolveClaudeSavedResumeLaunch(savedLaunch())

    expect(launch?.command).toBe(`claude '--plugin-dir' '/orca/agent-view' '--effort' 'max'`)
    expect(launch?.env?.[SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]).toBe(launch?.command)
    expect(launch?.droppedResumeArgv).toBe(true)
    expect(launch?.providerSession.id).toBe(SAVED)
  })

  it('leaves a resume alone when its transcript exists, the user picked it, or it runs elsewhere', () => {
    conversation(CONTINUED, PANE_STARTED + 1_000)
    rows.current = [row(PANE, SAVED)]

    expect(resolveClaudeSavedResumeLaunch(savedLaunch({ resumeOrigin: undefined }))).toBeNull()
    expect(resolveClaudeSavedResumeLaunch(savedLaunch({ local: false }))).toBeNull()
    conversation(SAVED, PANE_STARTED)
    expect(resolveClaudeSavedResumeLaunch(savedLaunch())).toBeNull()
  })
})
