import {
  DEFAULT_PI_WEB_SETTINGS,
  type PiWebEffectiveConfig,
  type PiWebEnvOverrides,
  type PiWebSettings
} from '../../shared/pi-web/pi-web-status-types'

export const PI_WEB_ENV_VARS = {
  enabled: 'ORCA_PI_WEB_ENABLED',
  serverUrl: 'ORCA_PI_WEB_URL',
  agentDir: 'ORCA_PI_WEB_AGENT_DIR',
  launchCwd: 'ORCA_PI_WEB_LAUNCH_CWD',
  launchCommand: 'ORCA_PI_WEB_LAUNCH_COMMAND'
} as const satisfies Record<keyof PiWebSettings, string>

function expandTilde(p: string, home: string): string {
  if (p === '~') {
    return home
  }
  return p.startsWith('~/') ? home + p.slice(1) : p
}

function nonEmpty(v: string | undefined): string | undefined {
  return v === undefined || v === '' ? undefined : v
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

// Why per field and typed: older profiles carry no piWeb key or a partial one, and a hand-edited
// or corrupt one may hold any JSON value; none of that may throw on the startup path.
function readStoredSettings(settings: unknown): PiWebSettings {
  const stored: Record<string, unknown> =
    typeof settings === 'object' && settings !== null ? { ...settings } : {}
  const defaults = DEFAULT_PI_WEB_SETTINGS
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : defaults.enabled,
    serverUrl: typeof stored.serverUrl === 'string' ? stored.serverUrl : defaults.serverUrl,
    agentDir: stringOr(stored.agentDir, defaults.agentDir),
    launchCwd: stringOr(stored.launchCwd, defaults.launchCwd),
    launchCommand: stringOr(stored.launchCommand, defaults.launchCommand)
  }
}

export function resolvePiWebEffectiveConfig(
  settings: unknown,
  env: NodeJS.ProcessEnv,
  home: string
): PiWebEffectiveConfig {
  const base = readStoredSettings(settings)
  const envOverrides: PiWebEnvOverrides = {}
  const fromEnv = (field: Exclude<keyof PiWebSettings, 'enabled'>): string | undefined => {
    const value = nonEmpty(env[PI_WEB_ENV_VARS[field]])
    if (value !== undefined) {
      envOverrides[field] = PI_WEB_ENV_VARS[field]
    }
    return value
  }
  const enabledEnv = env[PI_WEB_ENV_VARS.enabled]
  if (enabledEnv === '0' || enabledEnv === '1') {
    envOverrides.enabled = PI_WEB_ENV_VARS.enabled
  }
  const config: PiWebSettings = {
    enabled: enabledEnv === '0' ? false : enabledEnv === '1' ? true : base.enabled,
    serverUrl: fromEnv('serverUrl') ?? base.serverUrl ?? null,
    agentDir: expandTilde(fromEnv('agentDir') ?? base.agentDir, home),
    launchCwd: expandTilde(fromEnv('launchCwd') ?? base.launchCwd, home),
    launchCommand: fromEnv('launchCommand') ?? base.launchCommand
  }
  return { config, envOverrides }
}

export function resolvePiWebConfig(
  settings: unknown,
  env: NodeJS.ProcessEnv,
  home: string
): PiWebSettings {
  return resolvePiWebEffectiveConfig(settings, env, home).config
}
