import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrchestrationWorkerReleaseHarness } from './worker-release.test-support'

describe('worker-start --terminal with --agent', () => {
  const h = createOrchestrationWorkerReleaseHarness()
  beforeEach(() => {
    h.setup()
    const show = vi.mocked(h.runtime.showTerminal).getMockImplementation()
    vi.mocked(h.runtime.showTerminal).mockImplementation(async (handle) => ({
      ...(await show!(handle)),
      agentIdentity: 'codex'
    }))
  })
  afterEach(() => h.cleanup())

  const start = (agent: string) =>
    h.call('orchestration.workerStart', {
      from: 'term_coord',
      terminal: 'term_worker',
      agent,
      spec: 'reuse the worker'
    })

  it('accepts the agent already running in the terminal', async () => {
    await expect(start('codex')).resolves.toMatchObject({ state: 'ready' })
    expect(h.runtime.createTerminal).not.toHaveBeenCalled()
  })

  it('refuses a different agent, naming the one that is there, before any Dispatch', async () => {
    await expect(start('claude')).rejects.toMatchObject({
      code: 'invalid_argument',
      message:
        'Terminal term_worker is running codex, not claude. Pass --agent codex, or omit --agent.'
    })
    expect(h.db.db.prepare('SELECT count(*) AS n FROM dispatch_contexts').get()).toEqual({ n: 0 })
  })
})
