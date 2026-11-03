import { describe, expect, it } from 'vitest'
import { resolvePiWebConfig, resolvePiWebEffectiveConfig } from './pi-web-config'
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

  it('non-string stored fields fall back to defaults', () => {
    const defaults = resolvePiWebConfig(undefined, {}, '/h')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: exercises a hand-edited or corrupt persisted settings object.
    const corrupt = {
      enabled: 'yes',
      serverUrl: 5,
      agentDir: null,
      launchCwd: null,
      launchCommand: {}
    } as never
    expect(resolvePiWebConfig(corrupt, {}, '/h')).toEqual(defaults)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: exercises a persisted piWeb value that is not an object.
    expect(resolvePiWebConfig(null as never, {}, '/h')).toEqual(defaults)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: exercises a persisted piWeb value that is not an object.
    expect(resolvePiWebConfig('x' as never, {}, '/h')).toEqual(defaults)
    // A good field next to a bad one is kept.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: exercises a partly corrupt persisted settings object.
    const mixed = { enabled: false, agentDir: null, launchCwd: '~/pw' } as never
    expect(resolvePiWebConfig(mixed, {}, '/h')).toMatchObject({
      enabled: false,
      agentDir: '/h/.pi/agent',
      launchCwd: '/h/pw'
    })
  })

  it('effective config names the env variable behind each overridden field', () => {
    const effective = resolvePiWebEffectiveConfig(
      { ...DEFAULT_PI_WEB_SETTINGS, agentDir: '/set/agent' },
      {
        ORCA_PI_WEB_AGENT_DIR: '~/dev-agent',
        ORCA_PI_WEB_LAUNCH_COMMAND: 'node bin/pi-web.js --port 30142',
        // Empty or unrecognised values override nothing.
        ORCA_PI_WEB_URL: '',
        ORCA_PI_WEB_ENABLED: 'maybe'
      },
      '/h'
    )
    expect(effective.config.agentDir).toBe('/h/dev-agent')
    expect(effective.config.launchCommand).toBe('node bin/pi-web.js --port 30142')
    expect(effective.envOverrides).toEqual({
      agentDir: 'ORCA_PI_WEB_AGENT_DIR',
      launchCommand: 'ORCA_PI_WEB_LAUNCH_COMMAND'
    })
    expect(resolvePiWebEffectiveConfig(undefined, { ORCA_PI_WEB_ENABLED: '0' }, '/h')).toEqual({
      config: { ...resolvePiWebConfig(undefined, {}, '/h'), enabled: false },
      envOverrides: { enabled: 'ORCA_PI_WEB_ENABLED' }
    })
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
