import { EventEmitter } from 'node:events'
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

  function fakeChild() {
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
    return child
  }

  it('launcher strips ORCA_ vars, detaches and unrefs', async () => {
    const child = fakeChild()
    const spawnImpl = vi.fn(() => {
      queueMicrotask(() => child.emit('spawn'))
      return child
    })
    process.env.ORCA_TEST_LEAK = '1'
    try {
      await launchPiWebServer(
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
    expect(child.unref).toHaveBeenCalled()
  })

  it('launcher resolves ok on spawn event', async () => {
    const child = fakeChild()
    const p = launchPiWebServer(DEFAULT_PI_WEB_SETTINGS, (() => {
      queueMicrotask(() => child.emit('spawn'))
      return child
    }) as never)
    await expect(p).resolves.toEqual({ ok: true })
  })

  it('launcher resolves failure on error event without throwing', async () => {
    const child = fakeChild()
    const p = launchPiWebServer(DEFAULT_PI_WEB_SETTINGS, (() => {
      queueMicrotask(() => child.emit('error', new Error('spawn /bin/zsh ENOENT')))
      return child
    }) as never)
    await expect(p).resolves.toEqual({ ok: false, reason: 'spawn /bin/zsh ENOENT' })
    expect(child.unref).toHaveBeenCalled()
  })

  it('launcher resolves failure when spawn throws', async () => {
    const p = launchPiWebServer(DEFAULT_PI_WEB_SETTINGS, (() => {
      throw new Error('bad spawn')
    }) as never)
    await expect(p).resolves.toEqual({ ok: false, reason: 'bad spawn' })
  })
})
