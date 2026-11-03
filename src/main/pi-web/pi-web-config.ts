import {
  DEFAULT_PI_WEB_SETTINGS,
  type PiWebSettings
} from '../../shared/pi-web/pi-web-status-types'

function expandTilde(p: string, home: string): string {
  if (p === '~') {
    return home
  }
  return p.startsWith('~/') ? home + p.slice(1) : p
}

function nonEmpty(v: string | undefined): string | undefined {
  return v === undefined || v === '' ? undefined : v
}

// Why: older profiles may carry no piWeb key (or a partial one), so merge per-field over defaults.
export function resolvePiWebConfig(
  settings: PiWebSettings | undefined,
  env: NodeJS.ProcessEnv,
  home: string
): PiWebSettings {
  const base: PiWebSettings = { ...DEFAULT_PI_WEB_SETTINGS, ...settings }
  const enabledEnv = env.ORCA_PI_WEB_ENABLED
  return {
    enabled: enabledEnv === '0' ? false : enabledEnv === '1' ? true : base.enabled,
    serverUrl: nonEmpty(env.ORCA_PI_WEB_URL) ?? base.serverUrl ?? null,
    agentDir: expandTilde(nonEmpty(env.ORCA_PI_WEB_AGENT_DIR) ?? base.agentDir, home),
    launchCwd: expandTilde(nonEmpty(env.ORCA_PI_WEB_LAUNCH_CWD) ?? base.launchCwd, home),
    launchCommand: nonEmpty(env.ORCA_PI_WEB_LAUNCH_COMMAND) ?? base.launchCommand
  }
}
