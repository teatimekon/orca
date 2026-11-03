import { describe, expect, it, vi } from 'vitest'
import { launchPiWebServer, stripOrcaEnv } from './pi-web-launcher'
import { DEFAULT_PI_WEB_SETTINGS } from '../../shared/pi-web/pi-web-status-types'

describe('pi-web launcher', () => {
  it('stripOrcaEnv removes ORCA_ keys only', () => {
    expect(stripOrcaEnv({ ORCA_A: '1', ORCA_: 'x', PATH: '/bin', MY_ORCA_X: 'y' })).toEqual({
      PATH: '/bin',
      MY_ORCA_X: 'y'
    })
  })

  it('launcher strips ORCA_ vars, detaches and unrefs', () => {
    const unref = vi.fn()
    const spawnImpl = vi.fn(() => ({ unref }))
    process.env.ORCA_TEST_LEAK = '1'
    try {
      launchPiWebServer(
        { ...DEFAULT_PI_WEB_SETTINGS, agentDir: '/a', launchCwd: '/c', launchCommand: 'go' },
        spawnImpl as never
      )
    } finally {
      delete process.env.ORCA_TEST_LEAK
    }
    expect(spawnImpl).toHaveBeenCalledTimes(1)
    const [cmd, args, opts] = spawnImpl.mock.calls[0] as unknown as [
      string,
      string[],
      { cwd: string; detached: boolean; stdio: string; env: NodeJS.ProcessEnv }
    ]
    expect(cmd).toBe('/bin/zsh')
    expect(args).toEqual(['-lc', 'go'])
    expect(opts.cwd).toBe('/c')
    expect(opts.detached).toBe(true)
    expect(opts.stdio).toBe('ignore')
    expect(opts.env.PI_CODING_AGENT_DIR).toBe('/a')
    expect(Object.keys(opts.env).some((k) => k.startsWith('ORCA_'))).toBe(false)
    expect(unref).toHaveBeenCalled()
  })
})
