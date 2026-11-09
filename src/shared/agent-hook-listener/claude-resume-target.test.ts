import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveClaudeResumeTarget } from './claude-resume-target'

const PANE = '11111111-1111-4111-8111-111111111111'
const CONVERSATION = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'
const AUTOMATION = '44444444-4444-4444-8444-444444444444'
const JOB = '55555555-5555-4555-8555-555555555555'
const NOT_BEFORE = 1_800_000_000_000

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

/** A conversation file as Claude writes it: records carry its id and the launching entrypoint. */
function conversation(
  projectDir: string,
  id: string,
  options: { entrypoint?: string; modifiedAt?: number } = {}
): string {
  const transcriptPath = join(projectDir, `${id}.jsonl`)
  const records = [
    { type: 'mode', mode: 'normal', sessionId: id },
    { type: 'user', sessionId: id, entrypoint: options.entrypoint ?? 'cli', isSidechain: false }
  ]
  writeFileSync(transcriptPath, records.map((record) => `${JSON.stringify(record)}\n`).join(''))
  const seconds = (options.modifiedAt ?? NOT_BEFORE + 60_000) / 1000
  utimesSync(transcriptPath, seconds, seconds)
  return transcriptPath
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

const unheld = () => ({ heldSessionIds: new Set<string>(), notBefore: NOT_BEFORE })

describe('resolveClaudeResumeTarget', () => {
  it('keeps a session whose own transcript exists', () => {
    const { projectDir } = makeProject()
    conversation(projectDir, PANE)
    conversation(projectDir, CONVERSATION)

    expect(resolveClaudeResumeTarget(paneSession(projectDir), unheld)).toEqual({ kind: 'keep' })
  })

  it('keeps a session whose projects folder cannot be read on this machine', () => {
    const session = { ...paneSession('/nowhere/projects/-work-repo') }

    expect(resolveClaudeResumeTarget(session, unheld)).toEqual({ kind: 'keep' })
  })

  it('resumes the conversation the hook named when its session_id has no transcript', () => {
    const { projectDir } = makeProject()
    const transcriptPath = conversation(projectDir, CONVERSATION)

    expect(
      resolveClaudeResumeTarget({ ...paneSession(projectDir), transcriptPath }, unheld)
    ).toEqual({
      kind: 'substitute',
      via: 'transcript',
      session: { key: 'session_id', id: CONVERSATION, transcriptPath, cwd: '/work/repo' }
    })
  })

  it("resumes the conversation a daemon job ran this session as, keeping the pane's effort", () => {
    const { configDir, projectDir } = makeProject()
    const linkScanPath = conversation(projectDir, CONVERSATION)
    const jobDir = join(configDir, 'jobs', PANE.slice(0, 8))
    mkdirSync(jobDir, { recursive: true })
    writeFileSync(
      join(jobDir, 'state.json'),
      JSON.stringify({ sessionId: PANE, resumeSessionId: CONVERSATION, linkScanPath })
    )

    expect(resolveClaudeResumeTarget(paneSession(projectDir, 'max'), unheld)).toEqual({
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

  it('falls back to the newest interactive conversation nobody else holds since the pane began', () => {
    const { configDir, projectDir } = makeProject()
    // Another job's state under a different id proves nothing about this pane.
    const jobDir = join(configDir, 'jobs', JOB.slice(0, 8))
    mkdirSync(jobDir, { recursive: true })
    writeFileSync(join(jobDir, 'state.json'), JSON.stringify({ sessionId: JOB }))
    const expected = conversation(projectDir, CONVERSATION, { modifiedAt: NOT_BEFORE + 1_000 })
    conversation(projectDir, OTHER, { modifiedAt: NOT_BEFORE + 3_000 })
    conversation(projectDir, AUTOMATION, { entrypoint: 'sdk-cli', modifiedAt: NOT_BEFORE + 2_000 })
    conversation(projectDir, JOB, { modifiedAt: NOT_BEFORE - 1_000 })
    mkdirSync(join(projectDir, CONVERSATION, 'subagents'), { recursive: true })
    writeFileSync(join(projectDir, CONVERSATION, 'subagents', 'agent-a1.jsonl'), '{}\n')

    const target = resolveClaudeResumeTarget(paneSession(projectDir), () => ({
      heldSessionIds: new Set([OTHER]),
      notBefore: NOT_BEFORE
    }))

    expect(target).toEqual({
      kind: 'substitute',
      via: 'newest',
      session: { key: 'session_id', id: CONVERSATION, transcriptPath: expected, cwd: '/work/repo' }
    })
  })

  it('starts fresh when nothing continued the session', () => {
    const { projectDir } = makeProject()
    conversation(projectDir, OTHER, { modifiedAt: NOT_BEFORE - 1_000 })
    conversation(projectDir, AUTOMATION, { entrypoint: 'sdk-cli' })

    expect(resolveClaudeResumeTarget(paneSession(projectDir), unheld)).toEqual({ kind: 'fresh' })
  })

  it('skips the newest-conversation guess when the pane start is unknown', () => {
    const { projectDir } = makeProject()
    conversation(projectDir, CONVERSATION)

    expect(
      resolveClaudeResumeTarget(paneSession(projectDir), () => ({ heldSessionIds: new Set() }))
    ).toEqual({ kind: 'fresh' })
  })

  it('starts fresh in a folder Claude never wrote to', () => {
    const { configDir } = makeProject()
    const session = paneSession(join(configDir, 'projects', '-never-used'))

    expect(resolveClaudeResumeTarget(session, unheld)).toEqual({ kind: 'fresh' })
  })
})
