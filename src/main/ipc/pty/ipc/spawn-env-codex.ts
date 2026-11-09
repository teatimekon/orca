import { isNativeWindowsLocalPtySpawn } from '../../../runtime/terminal-model-query-authority'
import { resolvePtySpawnHostEnv } from '../spawn-host-env'
import type { PtyIpcSpawnState } from './spawn-state'
import type { ClaudeResumeLaunch } from '../host-env/claude-resume'

export async function assemblePtyIpcSpawnCodexEnv(ctx: PtyIpcSpawnState): Promise<void> {
  const args = ctx.args
  ctx.effectiveShellOverride = ctx.terminalRuntimeOptions.shellOverride
  ctx.nativeWindowsConptySpawn = isNativeWindowsLocalPtySpawn({
    connectionId: args.connectionId,
    cwd: args.cwd,
    shellOverride: ctx.effectiveShellOverride
  })
  const hostEnv = await resolvePtySpawnHostEnv({
    launchAgent: args.launchAgent,
    command: args.command,
    resumeProviderSession: args.resumeProviderSession,
    resumeOrigin: args.resumeOrigin,
    connectionId: args.connectionId,
    paneKey: ctx.reservationPaneKey,
    env: ctx.baseEnv,
    cwd: ctx.cwd,
    shellOverride: ctx.effectiveShellOverride,
    expectedWslDistro: ctx.expectedWslDistro,
    codexSelectionTarget: ctx.codexSelectionTarget,
    preAdopted: Boolean(ctx.preAdoptedStablePane),
    isDaemonHostSpawn: ctx.isDaemonHostSpawn,
    sessionId: ctx.effectiveSessionId,
    callerNamedSession: args.sessionId !== undefined,
    mintedSessionId: ctx.ownsNewIncarnation,
    resumeOnSelectedAccount: Boolean(args.replacesPtyId),
    emptySessionIdSkipsHostEnv: false,
    wslPassiveRestore: args.wslPassiveRestore === true,
    requestedAgentTeamsPath: ctx.requestedAgentTeamsPath,
    provider: ctx.provider,
    deps: ctx.deps,
    mark: (phase) => ctx.spawnTiming.mark(phase)
  })
  ctx.codexResumeLaunch = hostEnv.codexResumeLaunch
  if (hostEnv.codexResumeLaunch.droppedResumeArgv && ctx.effectiveLaunchConfig) {
    ctx.effectiveLaunchConfig = {
      ...ctx.effectiveLaunchConfig,
      agentCommand: hostEnv.launchCommand ?? ctx.effectiveLaunchConfig.agentCommand
    }
  }
  applyClaudeResumeLaunch(ctx, hostEnv.claudeResume)
  ctx.launchCommand = hostEnv.launchCommand
  ctx.baseEnv = hostEnv.baseEnv
  ctx.env = hostEnv.env
  ctx.selectedCodexHomePath = hostEnv.selectedCodexHomePath
  ctx.codexResumeHomeSelected = hostEnv.codexResumeHomeSelected
  ctx.skipCodexHomeEnv = hostEnv.skipCodexHomeEnv
  ctx.stripInheritedOrcaCodexHome = hostEnv.stripInheritedOrcaCodexHome
  ctx.spawnTiming.mark('host_env')
}

/** The spawn reports and seeds the session it actually resumes; a dropped one like Codex's. */
function applyClaudeResumeLaunch(ctx: PtyIpcSpawnState, launch: ClaudeResumeLaunch | null): void {
  if (!launch) {
    return
  }
  ctx.args.resumeProviderSession = launch.providerSession
  if (launch.droppedResumeArgv) {
    ctx.codexResumeLaunch = {
      ...ctx.codexResumeLaunch,
      droppedResumeArgv: true,
      notifyResumeUnavailable: true
    }
  }
}
