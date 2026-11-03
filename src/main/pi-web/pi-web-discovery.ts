import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PiWebSettings } from '../../shared/pi-web/pi-web-status-types'

export type PiWebDiscoveryDeps = {
  readDir?: (dir: string) => Promise<string[]>
  readFile?: (path: string) => Promise<string>
  probe?: (url: string) => Promise<boolean>
}

const PROBE_TIMEOUT_MS = 1500

async function defaultProbe(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/agent/running`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })
    await res.body?.cancel().catch(() => {})
    return res.status === 200
  } catch {
    return false
  }
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export async function discoverPiWebServer(
  config: PiWebSettings,
  deps: PiWebDiscoveryDeps = {}
): Promise<string | null> {
  const probe = deps.probe ?? defaultProbe
  if (config.serverUrl) {
    const url = stripSlash(config.serverUrl)
    return (await probe(url)) ? url : null
  }
  const readDir = deps.readDir ?? ((d: string) => readdir(d))
  const read = deps.readFile ?? ((p: string) => readFile(p, 'utf8'))
  const dir = join(config.agentDir, 'pi-web-run')
  let names: string[]
  try {
    names = await readDir(dir)
  } catch {
    return null
  }
  const records: { url: string; startedAt: number }[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) {
      continue
    }
    try {
      const rec = JSON.parse(await read(join(dir, name))) as { url?: unknown; startedAt?: unknown }
      if (typeof rec.url !== 'string' || !rec.url) {
        continue
      }
      const t = typeof rec.startedAt === 'string' ? Date.parse(rec.startedAt) : Number.NaN
      records.push({ url: stripSlash(rec.url), startedAt: Number.isNaN(t) ? 0 : t })
    } catch {
      // Why: stale or half-written records must never block discovery.
    }
  }
  records.sort((a, b) => b.startedAt - a.startedAt)
  for (const rec of records) {
    if (await probe(rec.url)) {
      return rec.url
    }
  }
  return null
}
