import { spawn } from 'node:child_process'
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

export function launchPiWebServer(config: PiWebSettings, spawnImpl: typeof spawn = spawn): void {
  const child = spawnImpl('/bin/zsh', ['-lc', config.launchCommand], {
    cwd: config.launchCwd,
    detached: true,
    stdio: 'ignore',
    env: { ...stripOrcaEnv(process.env), PI_CODING_AGENT_DIR: config.agentDir }
  })
  child.unref()
}
