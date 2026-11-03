import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fakeHome = await vi.hoisted(async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  return fs.mkdtempSync(path.join(os.tmpdir(), 'orca-guard-home-'))
})

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const homedir = (): string => fakeHome
  return { ...actual, default: { ...(actual as object), homedir }, homedir }
})

import { registerGrokHookOwner, unregisterGrokHookOwnerSync } from '../grok/grok-hook-owners'
import { ensureClaudeAgentTeamsShimDir } from '../runtime/claude-agent-teams-shim-env'

afterAll(() => {
  rmSync(fakeHome, { recursive: true, force: true })
})

describe('home writers with ORCA_DEV_NO_GLOBAL_HOOKS=1', () => {
  beforeEach(() => {
    vi.stubEnv('ORCA_DEV_NO_GLOBAL_HOOKS', '1')
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    rmSync(join(fakeHome, '.orca'), { recursive: true, force: true })
  })

  it('does not register a grok owner under the shared agent-hooks dir', () => {
    registerGrokHookOwner()
    unregisterGrokHookOwnerSync()
    expect(existsSync(join(fakeHome, '.orca', 'agent-hooks', 'grok-owners'))).toBe(false)
  })

  it('does not write the claude agent-teams tmux shim', async () => {
    const root = join(fakeHome, '.orca', 'claude-agent-teams-bin')
    await expect(ensureClaudeAgentTeamsShimDir(root)).resolves.toBe(root)
    expect(existsSync(root)).toBe(false)
  })

  it('still registers the grok owner when the guard is off', () => {
    vi.stubEnv('ORCA_DEV_NO_GLOBAL_HOOKS', '0')
    registerGrokHookOwner()
    expect(existsSync(join(fakeHome, '.orca', 'agent-hooks', 'grok-owners'))).toBe(true)
    unregisterGrokHookOwnerSync()
  })
})
