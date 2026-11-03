import { describe, expect, it } from 'vitest'
import { resolvePiWebConfig } from './pi-web-config'
import { DEFAULT_PI_WEB_SETTINGS } from '../../shared/pi-web/pi-web-status-types'

describe('resolvePiWebConfig', () => {
  it('env overrides beat settings and tilde expands', () => {
    const cfg = resolvePiWebConfig(
      { ...DEFAULT_PI_WEB_SETTINGS, agentDir: '/set/agent' },
      {
        ORCA_PI_WEB_ENABLED: '0',
        ORCA_PI_WEB_URL: 'http://x:1',
        ORCA_PI_WEB_AGENT_DIR: '~/a',
        ORCA_PI_WEB_LAUNCH_CWD: '~',
        ORCA_PI_WEB_LAUNCH_COMMAND: 'run'
      },
      '/home/u'
    )
    expect(cfg).toEqual({
      enabled: false,
      serverUrl: 'http://x:1',
      agentDir: '/home/u/a',
      launchCwd: '/home/u',
      launchCommand: 'run'
    })
  })

  it('uses defaults with expanded paths when settings are missing or partial', () => {
    const cfg = resolvePiWebConfig(undefined, {}, '/home/u')
    expect(cfg.enabled).toBe(true)
    expect(cfg.agentDir).toBe('/home/u/.pi/agent')
    expect(cfg.launchCwd).toBe('/home/u/Documents/code/pi-web')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: exercises a persisted settings object that lacks most fields.
    const partial = resolvePiWebConfig({ serverUrl: 'http://y' } as never, {}, '/h')
    expect(partial.serverUrl).toBe('http://y')
    expect(partial.launchCommand).toBe(DEFAULT_PI_WEB_SETTINGS.launchCommand)
  })

  it('ORCA_PI_WEB_ENABLED=1 re-enables', () => {
    const cfg = resolvePiWebConfig(
      { ...DEFAULT_PI_WEB_SETTINGS, enabled: false },
      { ORCA_PI_WEB_ENABLED: '1' },
      '/h'
    )
    expect(cfg.enabled).toBe(true)
  })
})
