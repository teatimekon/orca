import { spawnProcess } from '@orca/process-host'
import type { PiWebSettings } from '../../shared/pi-web/pi-web-status-types'

export function stripOrcaEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('ORCA_')) {
      out[key] = value
    }
  }
  return out
}

type PiWebSpawnOptions = {
  cwd: string
  detached: boolean
  stdio: 'ignore'
  env: NodeJS.ProcessEnv
}
type PiWebChild = ReturnType<typeof spawnProcess>
type PiWebSpawner = (file: string, args: string[], options: PiWebSpawnOptions) => PiWebChild | null

const defaultSpawn: PiWebSpawner = (program, args, options) =>
  spawnProcess({ program, args, ...options })

export type PiWebLaunchResult = { ok: true } | { ok: false; reason: string }

export function launchPiWebServer(
  config: PiWebSettings,
  spawnImpl: PiWebSpawner = defaultSpawn
): Promise<PiWebLaunchResult> {
  return new Promise((resolve) => {
    try {
      const child = spawnImpl('/bin/zsh', ['-lc', config.launchCommand], {
        cwd: config.launchCwd,
        detached: true,
        stdio: 'ignore',
        env: { ...stripOrcaEnv(process.env), PI_CODING_AGENT_DIR: config.agentDir }
      })
      // Why: a missing cwd or shell is reported asynchronously; without a listener Node would
      // raise an uncaught exception in the main process.
      child?.on('error', (err: Error) => {
        child?.unref?.()
        resolve({ ok: false, reason: err.message })
      })
      child?.on('spawn', () => {
        child?.unref?.()
        resolve({ ok: true })
      })
      child?.unref?.()
    } catch (err) {
      resolve({ ok: false, reason: err instanceof Error ? err.message : String(err) })
    }
  })
}
