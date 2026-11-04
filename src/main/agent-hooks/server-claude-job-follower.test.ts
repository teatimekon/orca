import { afterEach, describe, expect, it, vi } from 'vitest'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentHookServer } from './server'
import { buildBody, GOOD_PANE, PANE, postHookEvent } from './server.test-fixtures'
import { claudeJobTurnPayload } from './server/server-claude-job-follower'
import type { probeAgentProcessPresence } from '../../shared/agent-process-presence-probe'

vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: () => ({}) }))
const probe = vi.hoisted(() => vi.fn<typeof probeAgentProcessPresence>(async () => 'live'))
vi.mock('../../shared/agent-process-presence-probe', () => ({ probeAgentProcessPresence: probe }))

const FRONT = '11111111-1111-4111-8111-111111111111'
const JOB = '22222222-2222-4222-8222-222222222222'
const GHOST = '33333333-3333-4333-8333-333333333333'
const OTHER = '44444444-4444-4444-8444-444444444444'
const CWD = '/work/repo'
const agentProcess = JSON.stringify({ pid: 4001, platform: 'linux', startTime: 'birth-4001' })

const servers: AgentHookServer[] = []
const dirs: string[] = []

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.stop()
  }
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
  probe.mockReset().mockResolvedValue('live')
})

async function start(): Promise<AgentHookServer> {
  const server = new AgentHookServer()
  servers.push(server)
  await server.start({ env: 'production' })
  return server
}

function line(record: Record<string, unknown>): string {
  return `${JSON.stringify(record)}\n`
}

function prompt(sessionId: string, text: string): string {
  return line({ type: 'user', sessionId, cwd: CWD, message: { role: 'user', content: text } })
}

function reply(sessionId: string, text: string): string {
  return line({
    type: 'assistant',
    sessionId,
    message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text }] }
  })
}

/** A Claude config dir with the pane's own transcript, which /resume continued into a job. */
function makeAttachedJob(): { frontPath: string; jobPath: string } {
  const configDir = mkdtempSync(join(tmpdir(), 'claude-job-follower-'))
  dirs.push(configDir)
  const projectDir = join(configDir, 'projects', '-work-repo')
  mkdirSync(projectDir, { recursive: true })
  const frontPath = join(projectDir, `${FRONT}.jsonl`)
  writeFileSync(
    frontPath,
    prompt(FRONT, 'Foreground task') +
      reply(FRONT, 'Done.') +
      line({
        type: 'system',
        subtype: 'local_command',
        sessionId: FRONT,
        content: `<local-command-stdout>Opening "Feature work", running in the background (${JOB.slice(0, 8)})</local-command-stdout>`
      }) +
      // Claude Code writes a pointer that never reaches disk beside the job it printed.
      line({ type: 'continued-in', sessionId: FRONT, continuedInSessionId: GHOST })
  )
  const jobPath = join(projectDir, `${JOB}.jsonl`)
  writeFileSync(jobPath, prompt(JOB, 'carry on'))
  const jobDir = join(configDir, 'jobs', JOB.slice(0, 8))
  mkdirSync(jobDir, { recursive: true })
  writeFileSync(
    join(jobDir, 'state.json'),
    JSON.stringify({ sessionId: JOB, resumeSessionId: JOB, linkScanPath: jobPath })
  )
  return { frontPath, jobPath }
}

async function idleClaude(
  server: AgentHookServer,
  paneKey: string,
  sessionId: string,
  transcriptPath: string
): Promise<void> {
  for (const hook_event_name of ['UserPromptSubmit', 'Stop']) {
    const response = await postHookEvent(
      server,
      buildBody(
        {
          hook_event_name,
          session_id: sessionId,
          transcript_path: transcriptPath,
          cwd: CWD,
          prompt: 'Foreground task',
          ...(hook_event_name === 'Stop' ? { last_assistant_message: 'Done.' } : {})
        },
        { paneKey, tabId: paneKey.split(':')[0], agentProcess }
      )
    )
    expect([200, 204]).toContain(response.status)
  }
}

function row(server: AgentHookServer, paneKey: string) {
  return server.getStatusSnapshot().find((entry) => entry.paneKey === paneKey)
}

describe('AgentHookServerClaudeJobFollower', () => {
  it('rebinds a pane to the job it resumed and follows that transcript for its turn state', async () => {
    const { frontPath, jobPath } = makeAttachedJob()
    const server = await start()
    await idleClaude(server, PANE, FRONT, frontPath)
    expect(row(server, PANE)).toMatchObject({ state: 'done', providerSession: { id: FRONT } })

    expect(server.followClaudeJobsOnce()).toBe(1)
    expect(row(server, PANE)).toMatchObject({
      state: 'working',
      prompt: 'carry on',
      providerSession: { id: JOB, transcriptPath: jobPath }
    })

    // An unchanged transcript is not re-read or re-applied.
    expect(server.followClaudeJobsOnce()).toBe(0)

    appendFileSync(jobPath, reply(JOB, 'All done.'))
    expect(server.followClaudeJobsOnce()).toBe(1)
    expect(row(server, PANE)).toMatchObject({
      state: 'done',
      prompt: 'carry on',
      lastAssistantMessage: 'All done.',
      providerSession: { id: JOB }
    })

    appendFileSync(jobPath, prompt(JOB, 'one more thing'))
    expect(server.followClaudeJobsOnce()).toBe(1)
    expect(row(server, PANE)).toMatchObject({ state: 'working', prompt: 'one more thing' })
  })

  it('leaves panes whose Claude session is not a job alone', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'claude-job-follower-'))
    dirs.push(configDir)
    const projectDir = join(configDir, 'projects', '-work-repo')
    mkdirSync(projectDir, { recursive: true })
    const otherPath = join(projectDir, `${OTHER}.jsonl`)
    writeFileSync(otherPath, prompt(OTHER, 'Foreground task') + prompt(OTHER, 'still typing'))
    const server = await start()
    await idleClaude(server, GOOD_PANE, OTHER, otherPath)

    expect(server.followClaudeJobsOnce()).toBe(0)
    expect(row(server, GOOD_PANE)).toMatchObject({ state: 'done', providerSession: { id: OTHER } })
  })
})

describe('claudeJobTurnPayload', () => {
  const base = {
    paneKey: PANE,
    connectionId: null,
    payload: {
      state: 'done' as const,
      prompt: 'old',
      lastAssistantMessage: 'earlier',
      agentType: 'claude'
    }
  }

  it('returns nothing when the transcript agrees with the row', () => {
    expect(
      claudeJobTurnPayload(
        base,
        { state: 'done', prompt: 'old', lastAssistantMessage: 'earlier' },
        5
      )
    ).toBeUndefined()
  })

  it('drops the finished reply and tool fields when the job works again', () => {
    expect(
      claudeJobTurnPayload(
        { ...base, payload: { ...base.payload, toolName: 'Bash', turnCompletedAt: 1 } },
        { state: 'working', prompt: 'next' },
        5
      )
    ).toEqual({ state: 'working', prompt: 'next', agentType: 'claude' })
  })

  it('stamps the turn end once when the job finishes', () => {
    const working = { ...base, payload: { ...base.payload, state: 'working' as const } }
    expect(
      claudeJobTurnPayload(working, { state: 'done', lastAssistantMessage: 'fin' }, 5)
    ).toEqual({
      state: 'done',
      prompt: 'old',
      lastAssistantMessage: 'fin',
      agentType: 'claude',
      turnCompletedAt: 5
    })
    expect(
      claudeJobTurnPayload(
        { ...base, payload: { ...base.payload, turnCompletedAt: 3 } },
        { state: 'done', lastAssistantMessage: 'fin', interrupted: true },
        9
      )
    ).toEqual({
      state: 'done',
      prompt: 'old',
      lastAssistantMessage: 'fin',
      interrupted: true,
      agentType: 'claude',
      turnCompletedAt: 3
    })
  })
})
