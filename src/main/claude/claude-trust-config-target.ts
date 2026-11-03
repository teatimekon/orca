import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { parseWslUncPath } from '../../shared/wsl-paths'
import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth/runtime-auth-types'
import {
  resolveClaudeGlobalConfigFile,
  type ClaudeTrustPathStyle
} from './claude-folder-trust-file'

export type ClaudeTrustConfigTarget = {
  configFile: string
  keyStyle: ClaudeTrustPathStyle
  /** Maps a host-native path to the path the Claude process sees (WSL UNC → Linux). */
  toClaudePath?: (hostPath: string) => string | null
}

export function resolveLocalClaudeTrustConfig(args: {
  workspacePath: string
  env: Record<string, string | undefined>
  claudeAuth: ClaudeRuntimeAuthPreparation | null
  wslDistro: string | null
}): ClaudeTrustConfigTarget | null {
  const { claudeAuth } = args
  if (claudeAuth?.runtime === 'wsl' || args.wslDistro || parseWslUncPath(args.workspacePath)) {
    // Without guest auth preparation, configDir may name the Windows host's file.
    if (
      claudeAuth?.runtime !== 'wsl' ||
      !claudeAuth.wslLinuxConfigDir ||
      !parseWslUncPath(args.workspacePath)
    ) {
      return null
    }
    const legacyFile = join(claudeAuth.configDir, '.config.json')
    return {
      configFile: existsSync(legacyFile)
        ? legacyFile
        : claudeAuth.envPatch.CLAUDE_CONFIG_DIR
          ? join(claudeAuth.configDir, '.claude.json')
          : join(dirname(claudeAuth.configDir), '.claude.json'),
      keyStyle: 'posix',
      toClaudePath: (hostPath) => parseWslUncPath(hostPath)?.linuxPath ?? null
    }
  }
  const style = process.platform === 'win32' ? 'win32' : 'posix'
  const homeDir = (style === 'win32' ? args.env.USERPROFILE : args.env.HOME) || homedir()
  return {
    configFile: resolveClaudeGlobalConfigFile({
      env: args.env,
      homeDir,
      style,
      exists: existsSync
    }),
    keyStyle: style
  }
}
