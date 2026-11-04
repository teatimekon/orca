import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPtyHostEnv } from './assembly'
import type { BuildPtyHostEnvOptions } from './types'

const fixture = vi.hoisted(() => ({ userData: '' }))
vi.mock('../../../../shared/app-environment', () => ({
  getAppEnvironment: () => ({ getPath: () => fixture.userData, onWillQuit: vi.fn() })
}))
vi.mock('../../../agent-hooks/server', () => ({
  agentHookServer: { buildPtyEnv: () => ({ ORCA_AGENT_HOOK_PORT: '12345' }) }
}))
vi.mock('../../../pi/titlebar-extension-service', () => ({
  piTitlebarExtensionService: { buildPtyEnv: () => ({}), buildFreshOmpEnv: () => ({}) }
}))
vi.mock('../../../cli/orca-cli-child-path', () => ({ prependOrcaCliDirToChildPath: () => {} }))

let root: string
let options: BuildPtyHostEnvOptions

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-opencode-pure-'))
  fixture.userData = join(root, 'user-data')
  vi.stubEnv('HOME', join(root, 'home'))
  vi.stubEnv('USERPROFILE', join(root, 'home'))
  vi.stubEnv('XDG_CONFIG_HOME', join(root, 'xdg'))
  for (const key of ['OPENCODE_CONFIG_DIR', 'ORCA_OPENCODE_CONFIG_DIR', 'ORCA_OPENCODE_AGENT']) {
    vi.stubEnv(key, undefined)
  }
  mkdirSync(join(root, 'home'))
  options = {
    isPackaged: true,
    userDataPath: fixture.userData,
    selectedCodexHomePath: null,
    agentStatusHooksEnabled: true
  }
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

describe('pty env in the pure build never reaches the OpenCode plugin writer', () => {
  it.each([undefined, 'opencode', 'opencode2'] as const)(
    'writes no OpenCode plugin for launchAgent=%s',
    (launchAgent) => {
      const env = buildPtyHostEnv(
        'pure-pane',
        { HOME: join(root, 'home'), XDG_CONFIG_HOME: join(root, 'xdg'), SHELL: '/bin/sh' },
        { ...options, launchAgent }
      )
      expect(existsSync(join(root, 'xdg', 'opencode', 'plugins'))).toBe(false)
      expect(env.ORCA_OPENCODE_AGENT).toBeUndefined()
    }
  )
})
