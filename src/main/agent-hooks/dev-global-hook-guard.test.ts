import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const detectPresence = vi.hoisted(() => vi.fn())
vi.mock('./local-agent-cli-presence', () => ({
  detectLocalManagedAgentCliPresence: detectPresence
}))

import { globalHookWritesDisabled } from './dev-global-hook-guard'
import { installManagedAgentHooks } from './managed-agent-hook-controls'
import { writeHooksJson, writeManagedScript } from './installer-utils'

describe('globalHookWritesDisabled', () => {
  it('is true only when ORCA_DEV_NO_GLOBAL_HOOKS is 1', () => {
    expect(globalHookWritesDisabled({ ORCA_DEV_NO_GLOBAL_HOOKS: '1' })).toBe(true)
    expect(globalHookWritesDisabled({})).toBe(false)
    expect(globalHookWritesDisabled({ ORCA_DEV_NO_GLOBAL_HOOKS: '0' })).toBe(false)
  })
})

describe('with ORCA_DEV_NO_GLOBAL_HOOKS=1', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'orca-hook-guard-'))
    vi.stubEnv('ORCA_DEV_NO_GLOBAL_HOOKS', '1')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    detectPresence.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('skips every installer without probing CLIs', async () => {
    const results = await installManagedAgentHooks(null, {})
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.state === 'skipped' && r.detail?.includes('ORCA_DEV'))).toBe(true)
    expect(detectPresence).not.toHaveBeenCalled()
  })

  it('does not write scripts or hooks json', () => {
    const script = join(dir, 'hooks', 'claude-hook.sh')
    const json = join(dir, 'settings.json')
    writeManagedScript(script, '#!/bin/sh\n')
    writeHooksJson(json, { hooks: {} })
    expect(existsSync(script)).toBe(false)
    expect(existsSync(json)).toBe(false)
  })
})
