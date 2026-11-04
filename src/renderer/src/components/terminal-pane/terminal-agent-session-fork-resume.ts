import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'
import {
  isResumableTuiAgent,
  normalizeAgentProviderSession,
  type AgentProviderSessionMetadata,
  type ResumableTuiAgent
} from '../../../../shared/agent-session/lifecycle/agent-session-resume'
import { getAgentForkArgv } from '../../../../shared/agent-resume-argv'
import {
  resolveResumeLaunchRecipe,
  resolveTuiAgentLaunchEnv,
  resolveTuiAgentLaunchRawArgs
} from '../../../../shared/tui-agent-launch-defaults'
import { buildAgentResumeStartupPlan, resolveStartupShell } from '@/lib/tui-agent-startup'
import { resolveWorktreeResumeLaunchTarget } from '@/lib/worktree-resume-launch-target'
import { launchAiVaultSessionInNewTab } from '@/lib/launch-ai-vault-session'
import { pasteAgentLaunchPromptOnceReady } from '@/lib/launch-agent-tab-prompt-paste'

type AppStoreSnapshot = ReturnType<typeof useAppStore.getState>

/** The source pane's provider conversation when its agent can reopen it as a copy
 *  (`claude --resume <id> --fork-session`, `codex fork <id>`, `pi --fork <file>`). */
export type AgentSessionForkResume = {
  agent: ResumableTuiAgent
  providerSession: AgentProviderSessionMetadata
  /** Pane the conversation was read from; its launch recipe (args, env, command) carries to the fork. */
  paneKey: string
}

/** The pane's conversation, from its live status or its sleep record, when the agent can fork it. */
export function resolvePaneAgentSessionForkResume(
  state: AppStoreSnapshot,
  paneKey: string,
  agent: TuiAgent | null
): AgentSessionForkResume | null {
  if (!agent || !isResumableTuiAgent(agent)) {
    return null
  }
  const live = state.agentStatusByPaneKey[paneKey]
  const sleeping = state.sleepingAgentSessionsByPaneKey[paneKey]
  const providerSession =
    (live?.agentType === agent && live.restoredUnconfirmed !== true
      ? normalizeAgentProviderSession(live.providerSession)
      : null) ??
    (sleeping?.agent === agent ? normalizeAgentProviderSession(sleeping.providerSession) : null)
  if (!providerSession || !getAgentForkArgv(agent, providerSession)) {
    return null
  }
  return { agent, providerSession, paneKey }
}

/** The source pane's recorded launch recipe, so the fork starts with the same args and env. */
function resolveForkLaunchRecipe(
  state: AppStoreSnapshot,
  resume: AgentSessionForkResume,
  platform: NodeJS.Platform,
  shell: ReturnType<typeof resolveStartupShell>
): ReturnType<typeof resolveResumeLaunchRecipe> {
  const live = state.agentStatusByPaneKey[resume.paneKey]
  const sleeping = state.sleepingAgentSessionsByPaneKey[resume.paneKey]
  const launchConfig =
    (live && live.agentType === resume.agent
      ? state.getAgentLaunchConfigForStatusEntry(live)
      : undefined) ?? (sleeping?.agent === resume.agent ? sleeping.launchConfig : undefined)
  if (launchConfig) {
    return resolveResumeLaunchRecipe(launchConfig)
  }
  // An unrecorded launch (agent typed into a shell) forks with the configured defaults.
  return {
    agentArgs: resolveTuiAgentLaunchRawArgs(resume.agent, state.settings, undefined, shell),
    agentEnv: resolveTuiAgentLaunchEnv(resume.agent, state.settings, platform)
  }
}

/** Open the conversation copy in the fork workspace; false when no launch command could be built. */
export function launchAgentSessionForkResume(args: {
  resume: AgentSessionForkResume
  forkWorktreeId: string
  firstMessage: string
}): boolean {
  const state = useAppStore.getState()
  const { resume, forkWorktreeId, firstMessage } = args
  const target = resolveWorktreeResumeLaunchTarget(state, forkWorktreeId)
  const shell = resolveStartupShell(target.platform, target.shell)
  const plan = buildAgentResumeStartupPlan({
    agent: resume.agent,
    providerSession: resume.providerSession,
    cmdOverrides: state.settings?.agentCmdOverrides ?? {},
    ...resolveForkLaunchRecipe(state, resume, target.platform, shell),
    platform: target.platform,
    agentHostPlatform: target.agentHostPlatform,
    shell: target.shell,
    // The copy belongs to the new workspace; never cd back to the source's folder.
    resumeInLaunchCwd: true,
    fork: true
  })
  if (!plan) {
    return false
  }
  // No providerSession on the tab: the copy owns a new id, and cold restore must not resume the source.
  const launch = launchAiVaultSessionInNewTab({
    agent: resume.agent,
    worktreeId: forkWorktreeId,
    command: plan.launchCommand,
    ...(plan.env ? { env: plan.env } : {}),
    launchConfig: plan.launchConfig,
    launchSource: 'terminal_context_menu'
  })
  if (!firstMessage) {
    return true
  }
  if (launch.tabId === null) {
    // A paired host creates the tab after a round trip; hand the message to the user instead.
    void window.api.ui.writeTerminalClipboardText(firstMessage).then(
      () =>
        toast.message(
          translate(
            'components.terminalAgentSessionFork.firstMessageCopied',
            'The first message could not be sent on this host; it was copied to the clipboard.'
          )
        ),
      () => undefined
    )
    return true
  }
  void pasteAgentLaunchPromptOnceReady({
    worktreeId: forkWorktreeId,
    tabId: launch.tabId,
    agent: resume.agent,
    content: firstMessage,
    submit: true,
    prompt: firstMessage
  }).catch((error) => console.error('Fork first message delivery failed', error))
  return true
}
