const loggedTargets = new Set<string>()

// Opt-in so packaged and upstream behavior stay unchanged; dev builds set it to avoid clobbering a production Orca's shared files.
export function globalHookWritesDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ORCA_DEV_NO_GLOBAL_HOOKS === '1'
}

/** True when the caller must skip a write to shared user-global state; logs once per target. */
export function skipGlobalHookWrite(target: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!globalHookWritesDisabled(env)) {
    return false
  }
  if (!loggedTargets.has(target)) {
    loggedTargets.add(target)
    console.info('[agent-hooks] ORCA_DEV_NO_GLOBAL_HOOKS=1: skipped', target)
  }
  return true
}
