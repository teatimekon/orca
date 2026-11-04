import { toast } from 'sonner'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { settleAgentTabLaunch } from '@/lib/launch-agent-in-new-tab-host-agents'
import { newAgentPromptOutcome } from '@/lib/new-agent-prompt-outcome'
import { buildAgentSessionForkPrompt } from '@/lib/agent-session-fork-context'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { TUI_AGENT_CONFIG } from '../../../../shared/tui-agent-config'
import { getForkAgentLaunchPlatform } from './terminal-agent-session-fork-launch-platform'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { copyAgentSessionContext } from '@/lib/copy-agent-session-context'
import { translate } from '@/i18n/i18n'
import { planAgentSessionLaunch } from '@/lib/agent-session-launch-plan'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import {
  launchAgentSessionForkResume,
  resolvePaneAgentSessionForkResume,
  type AgentSessionForkResume
} from './terminal-agent-session-fork-resume'
import {
  buildForkWorkspaceName,
  createAgentSessionForkWorkspace
} from './terminal-agent-session-fork-workspace'

export type { AgentSessionForkResume } from './terminal-agent-session-fork-resume'

type ForkAgentSessionFromPaneArgs = {
  pane: ManagedPane
  tabId: string
  worktreeId: string
  groupId: string | null
}

export type PreparedAgentSessionFork = {
  prompt: string
  agent: TuiAgent | null
  worktreeId: string
  focusSource: () => void
  /** Present when the fork continues the conversation itself instead of pasting captured context. */
  resume?: AgentSessionForkResume
  /** Suggested workspace name, offered for editing in the dialog. */
  defaultWorkspaceName?: string
}

export type AgentSessionForkOptions = {
  /** Workspace (and branch) name the user typed; empty keeps the `<source>-fork` default. */
  workspaceName?: string
  /** Sent to the forked agent once it is ready; empty leaves the user to type. */
  firstMessage?: string
}

function resolveTuiAgent(value: string | null | undefined): TuiAgent | null {
  return value && Object.hasOwn(TUI_AGENT_CONFIG, value) ? (value as TuiAgent) : null
}

async function copyForkContext(prompt: string, focusSource: () => void): Promise<boolean> {
  try {
    await window.api.ui.writeTerminalClipboardText(prompt)
    toast.message(
      translate(
        'auto.components.terminal.pane.terminal.agent.session.fork.c00421d320',
        'Fork context copied. Launch an agent and paste it to start the fork.'
      )
    )
    focusSource()
    return true
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : translate(
            'auto.components.terminal.pane.terminal.agent.session.fork.2317900211',
            'Failed to copy fork context.'
          )
    )
    focusSource()
    return false
  }
}

export function prepareAgentSessionForkFromPane({
  pane,
  tabId,
  worktreeId
}: ForkAgentSessionFromPaneArgs): PreparedAgentSessionFork | null {
  const paneKey = makePaneKey(tabId, pane.leafId)
  const state = useAppStore.getState()
  const sourceAgent = resolveTuiAgent(state.agentStatusByPaneKey[paneKey]?.agentType)
  const tabAgent = resolveTuiAgent(
    state.tabsByWorktree[worktreeId]?.find((tab) => tab.id === tabId)?.launchAgent
  )
  const agent = sourceAgent ?? tabAgent
  // Captured text stays the fallback: a pane without a forkable conversation still forks its context.
  const prompt = buildAgentSessionForkPrompt({
    capturedText: pane.serializeAddon.serialize({ scrollback: 800 }),
    sourceLabel: paneKey,
    agentLabel: agent
  })

  if (!prompt) {
    toast.error(
      translate(
        'auto.components.terminal.pane.terminal.agent.session.fork.046e8d853c',
        'No terminal context to fork'
      )
    )
    pane.terminal.focus()
    return null
  }

  const sourceWorktree = state.getKnownWorktreeById(worktreeId)
  const resume = resolvePaneAgentSessionForkResume(state, paneKey, agent)
  return {
    prompt,
    agent,
    worktreeId,
    focusSource: () => pane.terminal.focus(),
    ...(resume ? { resume } : {}),
    defaultWorkspaceName: buildForkWorkspaceName(
      sourceWorktree?.displayName || sourceWorktree?.branch || ''
    )
  }
}

export async function copyAgentSessionForkContext(
  fork: PreparedAgentSessionFork
): Promise<boolean> {
  return copyForkContext(fork.prompt, fork.focusSource)
}

// Standalone Copy Context omits the dialog’s fork instructions so it can be pasted into another tool.
export async function copyAgentSessionContextFromPane(pane: ManagedPane): Promise<boolean> {
  return copyAgentSessionContext(
    pane.serializeAddon.serialize({ scrollback: 800 }),
    () => pane.terminal.focus(),
    translate(
      'auto.components.terminal.pane.terminal.agent.session.fork.f62b40e2c7',
      'No terminal context to copy'
    )
  )
}

export async function startAgentSessionFork(
  fork: PreparedAgentSessionFork,
  options: AgentSessionForkOptions = {}
): Promise<boolean> {
  const workspace = await createAgentSessionForkWorkspace({
    worktreeId: fork.worktreeId,
    agent: fork.agent,
    workspaceName: options.workspaceName
  })
  if (!workspace) {
    return false
  }
  const { forkWorktreeId } = workspace
  const firstMessage = options.firstMessage?.trim() ?? ''

  if (fork.resume) {
    // The launcher opens the fork surface; revealing must not seed a sibling shell.
    const revealed = activateAndRevealWorktree(forkWorktreeId, {
      sidebarRevealBehavior: 'auto',
      providesInitialSurface: true
    })
    if (
      revealed !== false &&
      launchAgentSessionForkResume({ resume: fork.resume, forkWorktreeId, firstMessage })
    ) {
      toast.success(
        translate(
          'components.terminalAgentSessionFork.resumedToast',
          'Conversation continued in a new child workspace'
        )
      )
      return true
    }
  }

  if (!fork.agent) {
    activateAndRevealWorktree(forkWorktreeId, { sidebarRevealBehavior: 'auto' })
    return copyAgentSessionForkContext(fork)
  }
  const prompt = firstMessage ? `${fork.prompt}\n\n${firstMessage}` : fork.prompt
  const agentSessionLaunchPlan = planAgentSessionLaunch(useAppStore.getState(), {
    requestId: newAgentLaunchRequestId(),
    agent: fork.agent,
    workspace: { kind: 'git-worktree', worktreeId: forkWorktreeId },
    prompt,
    promptDelivery: 'draft'
  })
  const launchPlatform = getForkAgentLaunchPlatform({
    repo: workspace.sourceRepo,
    worktreePath: workspace.worktreePath,
    projectRuntime: workspace.sourceProjectRuntime
  })
  const result = launchAgentInNewTab({
    agent: fork.agent,
    worktreeId: forkWorktreeId,
    prompt,
    promptDelivery: 'draft',
    launchSource: 'terminal_context_menu',
    agentSessionLaunchPlan,
    // The launcher opens the fork surface; revealing must not seed a sibling shell.
    beforeSurfaceOpen: () =>
      activateAndRevealWorktree(forkWorktreeId, {
        sidebarRevealBehavior: 'auto',
        providesInitialSurface: true
      }) !== false,
    ...(launchPlatform ? { launchPlatform } : {})
  })
  const settled = await settleAgentTabLaunch(result)
  const delivery =
    result?.promptDeliveryResult ??
    (settled.kind === 'structured' ? settled.promptDeliveryResult : undefined)
  if (
    (settled.kind !== 'terminal' && settled.kind !== 'structured') ||
    (delivery && !(await newAgentPromptOutcome({ delivery })).delivered)
  ) {
    activateAndRevealWorktree(forkWorktreeId, { sidebarRevealBehavior: 'auto' })
    return copyAgentSessionForkContext(fork)
  }
  notifyForkOpened()
  return true
}

function notifyForkOpened(): void {
  toast.success(
    translate(
      'components.terminalAgentSessionFork.forkOpenedToast',
      'Session fork opened in a new child workspace'
    )
  )
}

export async function forkAgentSessionFromPane(args: ForkAgentSessionFromPaneArgs): Promise<void> {
  const fork = prepareAgentSessionForkFromPane(args)
  if (fork) {
    await startAgentSessionFork(fork)
  }
}
