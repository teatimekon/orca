import { describe, expect, it, vi } from 'vitest'
import { discoverPiWebServer } from './pi-web-discovery'
import { DEFAULT_PI_WEB_SETTINGS } from '../../shared/pi-web/pi-web-status-types'

const config = { ...DEFAULT_PI_WEB_SETTINGS, agentDir: '/agent' }

function fakeFs(files: Record<string, string>) {
  return {
    readDir: async () => Object.keys(files),
    readFile: async (p: string) => {
      const name = p.split('/').pop() as string
      return files[name]
    }
  }
}

describe('discoverPiWebServer', () => {
  it('ignores dead records', async () => {
    const fs = fakeFs({
      '1.json': JSON.stringify({
        pid: 1,
        port: 1,
        url: 'http://old:1/',
        startedAt: '2026-11-03T07:00:00.000Z'
      }),
      '2.json': JSON.stringify({
        pid: 2,
        port: 2,
        url: 'http://new:2',
        startedAt: '2026-11-03T08:00:00.000Z'
      }),
      '3.json': '{not json',
      'notes.txt': 'x'
    })
    const probe = vi.fn(async (url: string) => url === 'http://old:1')
    const url = await discoverPiWebServer(config, { ...fs, probe })
    expect(url).toBe('http://old:1')
    expect(probe.mock.calls.map((c) => c[0])).toEqual(['http://new:2', 'http://old:1'])
  })

  it('explicit serverUrl skips records', async () => {
    const readDir = vi.fn(async () => [])
    const probe = vi.fn(async () => true)
    const url = await discoverPiWebServer(
      { ...config, serverUrl: 'http://fixed:9/' },
      { readDir, readFile: async () => '', probe }
    )
    expect(url).toBe('http://fixed:9')
    expect(readDir).not.toHaveBeenCalled()
    const dead = await discoverPiWebServer(
      { ...config, serverUrl: 'http://fixed:9' },
      { readDir, readFile: async () => '', probe: async () => false }
    )
    expect(dead).toBeNull()
  })

  it('returns null when the directory is missing', async () => {
    const url = await discoverPiWebServer(config, {
      readDir: async () => {
        throw new Error('ENOENT')
      },
      readFile: async () => '',
      probe: async () => true
    })
    expect(url).toBeNull()
  })
})
