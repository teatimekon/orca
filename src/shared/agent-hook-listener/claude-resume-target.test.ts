import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveClaudeResumeTarget } from './claude-resume-target'

const PANE = '11111111-1111-4111-8111-111111111111'
const CONVERSATION = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'
const JOB = '55555555-5555-4555-8555-555555555555'

const createdDirs: string[] = []

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeProject() {
  const configDir = mkdtempSync(join(tmpdir(), 'claude-resume-target-'))
  createdDirs.push(configDir)
  const projectDir = join(configDir, 'projects', '-work-repo')
  mkdirSync(projectDir, { recursive: true })
  return { configDir, projectDir }
}

/** A conversation file as Claude writes it: its records carry its own id. */
function conversation(projectDir: string, id: string): string {
  const transcriptPath = join(projectDir, `${id}.jsonl`)
  const records = [
    { type: 'mode', mode: 'normal', sessionId: id },
    { type: 'user', sessionId: id, entrypoint: 'cli', isSidechain: false }
  ]
  writeFileSync(transcriptPath, records.map((record) => `${JSON.stringify(record)}\n`).join(''))
  return transcriptPath
}

function writeJobState(configDir: string, state: Record<string, unknown>): void {
  const jobDir = join(configDir, 'jobs', String(state.sessionId).slice(0, 8))
  mkdirSync(jobDir, { recursive: true })
  writeFileSync(join(jobDir, 'state.json'), JSON.stringify(state))
}

function paneSession(projectDir: string, effort?: string) {
  return {
    key: 'session_id' as const,
    id: PANE,
    transcriptPath: join(projectDir, `${PANE}.jsonl`),
    cwd: '/work/repo',
    ...(effort ? { effort } : {})
  }
}

describe('resolveClaudeResumeTarget', () => {
  it('keeps a session whose own transcript exists', () => {
    const { projectDir } = makeProject()
    conversation(projectDir, PANE)
    conversation(projectDir, CONVERSATION)

    expect(resolveClaudeResumeTarget(paneSession(projectDir))).toEqual({ kind: 'keep' })
  })

  it('keeps a session whose projects folder cannot be read on this machine', () => {
    expect(resolveClaudeResumeTarget(paneSession('/nowhere/projects/-work-repo'))).toEqual({
      kind: 'keep'
    })
  })

  it('resumes the conversation the hook named when its session_id has no transcript', () => {
    const { projectDir } = makeProject()
    const transcriptPath = conversation(projectDir, CONVERSATION)

    expect(resolveClaudeResumeTarget({ ...paneSession(projectDir), transcriptPath })).toEqual({
      kind: 'substitute',
      via: 'transcript',
      session: { key: 'session_id', id: CONVERSATION, transcriptPath, cwd: '/work/repo' }
    })
  })

  it("resumes the conversation a daemon job ran this session as, keeping the pane's effort", () => {
    const { configDir, projectDir } = makeProject()
    const linkScanPath = conversation(projectDir, CONVERSATION)
    writeJobState(configDir, { sessionId: PANE, resumeSessionId: CONVERSATION, linkScanPath })

    expect(resolveClaudeResumeTarget(paneSession(projectDir, 'max'))).toEqual({
      kind: 'substitute',
      via: 'job',
      session: {
        key: 'session_id',
        id: CONVERSATION,
        transcriptPath: linkScanPath,
        cwd: '/work/repo',
        effort: 'max'
      }
    })
  })

  it('starts fresh rather than guess at another conversation in the same folder', () => {
    const { configDir, projectDir } = makeProject()
    conversation(projectDir, OTHER)
    // Another job's state proves nothing about this pane's session.
    writeJobState(configDir, { sessionId: JOB, resumeSessionId: OTHER })

    expect(resolveClaudeResumeTarget(paneSession(projectDir))).toEqual({ kind: 'fresh' })
  })

  it('starts fresh in a folder Claude never wrote to', () => {
    const { configDir } = makeProject()

    expect(
      resolveClaudeResumeTarget(paneSession(join(configDir, 'projects', '-never-used')))
    ).toEqual({ kind: 'fresh' })
  })
})
