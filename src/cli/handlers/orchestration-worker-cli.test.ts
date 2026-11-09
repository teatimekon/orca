import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()
const originalExitCode = process.exitCode
vi.mock('../format', async (importOriginal) => {
  const original = await importOriginal<{ printResult: typeof printResult }>()
  return { printResult: vi.fn(original.printResult) }
})
vi.mock('../selectors', () => ({ getTerminalHandle: vi.fn() }))

import { ORCHESTRATION_HANDLERS } from './orchestration'
import { printResult } from '../format'
import { parseArgs, validateCommandAndFlags } from '../args'

import { RuntimeClient } from '../runtime-client'
import { ORCHESTRATION_WORKER_COMMAND_SPECS } from '../specs/orchestration-worker-specs'

const client = new RuntimeClient('/tmp/orca-worker-cli', 60_000, null, null)

describe('orchestration worker-start CLI contract', () => {
  beforeEach(() => {
    callMock.mockReset()
    vi.spyOn(client, 'call').mockImplementation(callMock)
    vi.mocked(printResult).mockClear()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    process.exitCode = undefined
    vi.stubEnv('ORCA_CLI_COMMAND', undefined)
    vi.stubEnv('ORCA_DEV_CLI_INVOCATION', undefined)
    vi.stubEnv('ORCA_USER_DATA_PATH', undefined)
    vi.stubEnv('ORCA_TERMINAL_HANDLE', 'term_coord')
    vi.stubEnv('ORCA_AGENT_SESSION_ID', undefined)
  })

  afterEach(() => {
    process.exitCode = originalExitCode
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const invokeWorkerStart = (flags: Map<string, string | boolean>, json = true) =>
    ORCHESTRATION_HANDLERS['orchestration worker-start']({
      flags,
      client,
      cwd: '/tmp/repo',
      json
    })

  it('sets an unsuccessful exit code for an unknown receipt', async () => {
    callMock.mockResolvedValue({
      result: {
        taskId: 'task_1',
        dispatchId: 'ctx_1',
        state: 'outcome_unknown',
        effects: [],
        residualResources: []
      }
    })

    await invokeWorkerStart(
      new Map<string, string | boolean>([
        ['task', 'task_1'],
        ['agent', 'codex'],
        ['from', 'term_coord']
      ])
    )

    expect(process.exitCode).toBe(1)
  })
  it('accepts --terminal with --agent and sends both to the runtime', async () => {
    const parsed = parseArgs([
      'orchestration',
      'worker-start',
      '--spec',
      'reuse',
      '--terminal',
      'term_worker',
      '--agent',
      'codex'
    ])
    expect(() => validateCommandAndFlags(ORCHESTRATION_WORKER_COMMAND_SPECS, parsed)).not.toThrow()
    callMock.mockResolvedValue({
      result: { taskId: 'task_1', dispatchId: 'ctx_1', state: 'ready', effects: [] }
    })

    await invokeWorkerStart(parsed.flags)

    const start = callMock.mock.calls.find(([method]) => method === 'orchestration.workerStart')
    expect(start?.[1]).toMatchObject({ terminal: 'term_worker', agent: 'codex' })
  })
})
