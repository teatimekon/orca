import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { resolveOwner } from '@/lib/resolve-owner'
import { getLocalProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'
import { toRuntimeExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import { slugifyForWorkspaceName } from '../../../../shared/workspace-name'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { TuiAgent } from '../../../../shared/tui-agent'

type AppStoreSnapshot = ReturnType<typeof useAppStore.getState>

export type AgentSessionForkWorkspaceRequest = {
  worktreeId: string
  agent: TuiAgent | null
  /** Workspace (and branch) name the user typed; empty keeps the `<source>-fork` default. */
  workspaceName?: string
}

export type AgentSessionForkWorkspace = {
  forkWorktreeId: string
  worktreePath: string | undefined
  sourceRepo: AppStoreSnapshot['repos'][number] | undefined
  sourceProjectRuntime: ReturnType<typeof getLocalProjectExecutionRuntimeContext>
}

export function buildForkWorkspaceName(sourceName: string): string {
  return slugifyForWorkspaceName(`${sourceName}-fork`) || 'session-fork'
}

function getUsableForkBase(
  worktree:
    | { branch?: string | null; isArchived?: boolean; isBare?: boolean; repoId?: string }
    | null
    | undefined,
  repo: { kind?: string } | null | undefined,
  worktreeId: string
): string | null {
  const branch = worktree?.branch?.trim()
  if (
    worktreeId === FLOATING_TERMINAL_WORKTREE_ID ||
    !branch ||
    worktree?.isArchived ||
    worktree?.isBare ||
    !repo ||
    repo.kind === 'folder'
  ) {
    return null
  }
  return branch
}

/** The transport that owns the source: its server, else where this app reaches it (local or SSH). */
function forkCreationHostId(
  state: Parameters<typeof resolveOwner>[0],
  worktreeId: string
): ExecutionHostId | undefined {
  const owner = resolveOwner(state, { workspaceId: worktreeId })
  if (owner.kind !== 'resolved') {
    return undefined
  }
  const { endpoint, at } = owner.owner
  return endpoint.kind === 'environment' ? toRuntimeExecutionHostId(endpoint.environmentId) : at
}

/** Create the fork's git worktree beside the source; null (after a toast) when it cannot be made. */
export async function createAgentSessionForkWorkspace(
  request: AgentSessionForkWorkspaceRequest
): Promise<AgentSessionForkWorkspace | null> {
  const store = useAppStore.getState()
  const sourceWorktree = store.getKnownWorktreeById(request.worktreeId)
  if (!sourceWorktree) {
    toast.error(
      translate(
        'auto.components.terminal.pane.terminal.agent.session.fork.f867385bb5',
        'Could not find the source workspace for this fork.'
      )
    )
    return null
  }
  const sourceRepo = store.repos.find((repo) => repo.id === sourceWorktree.repoId)
  const sourceProjectRuntime = getLocalProjectExecutionRuntimeContext(store, request.worktreeId)
  const sourceBranch = getUsableForkBase(sourceWorktree, sourceRepo, request.worktreeId)
  if (!sourceBranch) {
    toast.error(
      translate(
        'auto.components.terminal.pane.terminal.agent.session.fork.38e41edc6e',
        'This workspace cannot be forked into a git worktree.'
      )
    )
    return null
  }
  const requestedName = request.workspaceName?.trim() ?? ''
  const forkName =
    (requestedName && slugifyForWorkspaceName(requestedName)) ||
    buildForkWorkspaceName(sourceWorktree.displayName || sourceBranch)
  const displayName = requestedName || `Fork of ${sourceWorktree.displayName || forkName}`
  try {
    const created = await store.createWorktree(
      sourceWorktree.repoId,
      forkName,
      sourceBranch,
      'inherit',
      undefined,
      'terminal_context_menu',
      displayName,
      undefined,
      undefined,
      undefined,
      request.agent ?? undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        // Why: a project two hosts publish refuses a host-less create; the fork belongs on its source's host.
        executionHostId: forkCreationHostId(store, request.worktreeId),
        // A fork branches off the source conversation, so it nests under that workspace in the sidebar.
        parentWorktreeId: request.worktreeId
      }
    )
    return {
      forkWorktreeId: created.worktree.id,
      worktreePath: created.worktree.path,
      sourceRepo,
      sourceProjectRuntime
    }
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : translate(
            'auto.components.terminal.pane.terminal.agent.session.fork.fd3d12a1e1',
            'Failed to create fork workspace.'
          )
    )
    return null
  }
}
