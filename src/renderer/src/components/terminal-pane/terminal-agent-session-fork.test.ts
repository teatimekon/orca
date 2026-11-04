import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'

const mockLaunchAgentInNewTab = vi.fn()
const mockLaunchAiVaultSessionInNewTab = vi.fn()
const mockPasteAgentLaunchPromptOnceReady = vi.fn()
const mockResolveWorktreeResumeLaunchTarget = vi.fn()
const mockActivateAndRevealWorktree = vi.fn()
const mockCreateWorktree = vi.fn()
const mockToast = {
  error: vi.fn(),
  message: vi.fn(),
  success: vi.fn()
}
const mockWriteClipboardText = vi.fn(async () => undefined)
const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const PANE_KEY = `tab-1:${LEAF_ID}`
const FORK_OPTIONS = { executionHostId: 'local', parentWorktreeId: 'wt-1' }

const projects: {
  id: string
  sourceRepoIds: string[]
  localWindowsRuntimePreference?: { kind: 'windows-host' } | { kind: 'wsl'; distro: string }
}[] = []

const repos: { id: string; kind?: 'git' | 'folder'; connectionId?: string | null }[] = []

type StatusEntry = {
  agentType?: string
  providerSession?: { key: 'session_id' | 'conversation_id'; id: string; transcriptPath?: string }
  restoredUnconfirmed?: boolean
}

const store = {
  activeRepoId: 'repo-1',
  activeWorktreeId: 'wt-1',
  projects,
  repos,
  settings: {} as {
    localWindowsRuntimeDefault?: { kind: 'windows-host' } | { kind: 'wsl'; distro: string }
  },
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: an empty test catalog; rows are typed below.
  worktreesByRepo: {} as Record<
    string,
    {
      id: string
      repoId: string
      path?: string
      projectId?: string
      hostId?: 'local' | 'ssh:box'
      runtimeOwnerEnvironmentId?: string
    }[]
  >,
  agentStatusByPaneKey: {} as Record<string, StatusEntry>,
  sleepingAgentSessionsByPaneKey: {} as Record<
    string,
    { agent: string; providerSession: StatusEntry['providerSession']; launchConfig?: unknown }
  >,
  tabsByWorktree: {} as Record<string, { id: string; launchAgent?: string | null }[]>,
  getKnownWorktreeById: vi.fn(),
  getAgentLaunchConfigForStatusEntry: vi.fn(),
  createWorktree: mockCreateWorktree
}

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => store
  }
}))

vi.mock('@/lib/launch-agent-in-new-tab', () => ({
  launchAgentInNewTab: mockLaunchAgentInNewTab
}))

vi.mock('@/lib/launch-ai-vault-session', () => ({
  launchAiVaultSessionInNewTab: mockLaunchAiVaultSessionInNewTab
}))

vi.mock('@/lib/launch-agent-tab-prompt-paste', () => ({
  pasteAgentLaunchPromptOnceReady: mockPasteAgentLaunchPromptOnceReady
}))

vi.mock('@/lib/worktree-resume-launch-target', () => ({
  resolveWorktreeResumeLaunchTarget: mockResolveWorktreeResumeLaunchTarget
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: mockActivateAndRevealWorktree
}))

vi.mock('sonner', () => ({
  toast: mockToast
}))

function makePane(capturedText: string): ManagedPane {
  return {
    leafId: LEAF_ID,
    serializeAddon: {
      serialize: vi.fn(() => capturedText)
    },
    terminal: {
      focus: vi.fn()
    }
  } as unknown as ManagedPane
}

describe('forkAgentSessionFromPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.activeRepoId = 'repo-1'
    store.activeWorktreeId = 'wt-1'
    store.projects = [
      {
        id: 'repo-1',
        sourceRepoIds: ['repo-1']
      }
    ]
    store.repos = [{ id: 'repo-1', kind: 'git' }]
    store.settings = { localWindowsRuntimeDefault: { kind: 'windows-host' } }
    store.worktreesByRepo = {
      'repo-1': [
        { id: 'wt-1', repoId: 'repo-1', path: 'C:\\repo', projectId: 'repo-1', hostId: 'local' }
      ]
    }
    store.agentStatusByPaneKey = {}
    store.sleepingAgentSessionsByPaneKey = {}
    store.tabsByWorktree = { 'wt-1': [{ id: 'tab-1' }] }
    store.getKnownWorktreeById.mockReturnValue({
      id: 'wt-1',
      repoId: 'repo-1',
      displayName: 'auth-feature',
      branch: 'feature/auth'
    })
    store.getAgentLaunchConfigForStatusEntry.mockReturnValue(undefined)
    mockCreateWorktree.mockResolvedValue({
      worktree: {
        id: 'wt-fork'
      }
    })
    mockLaunchAgentInNewTab.mockImplementation((args) => {
      args.beforeSurfaceOpen?.({ kind: 'local-terminal' })
      return {
        surface: { kind: 'local-terminal', tabId: 'tab-2' },
        startupPlan: {},
        pasteDraftAfterLaunch: true
      }
    })
    mockLaunchAiVaultSessionInNewTab.mockReturnValue({ tabId: 'tab-2' })
    mockPasteAgentLaunchPromptOnceReady.mockResolvedValue({
      delivered: true,
      failureNotified: false
    })
    mockResolveWorktreeResumeLaunchTarget.mockReturnValue({
      platform: 'darwin',
      agentHostPlatform: 'darwin',
      shell: undefined
    })
    mockWriteClipboardText.mockResolvedValue(undefined)
    vi.stubGlobal('window', {
      api: {
        ui: {
          writeTerminalClipboardText: mockWriteClipboardText
        },
        platform: {
          get: () => ({ platform: 'win32' })
        }
      }
    })
  })

  it('creates a nested workspace fork with a draft agent tab when the source agent is known', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'codex' }
    }
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: 'group-1'
    })

    expect(mockCreateWorktree).toHaveBeenCalledWith(
      'repo-1',
      'auth-feature-fork',
      'feature/auth',
      'inherit',
      undefined,
      'terminal_context_menu',
      'Fork of auth-feature',
      undefined,
      undefined,
      undefined,
      'codex',
      ...Array(14).fill(undefined),
      FORK_OPTIONS
    )

    expect(mockLaunchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'codex',
        worktreeId: 'wt-fork',
        prompt: expect.stringContaining('User: compare OAuth options'),
        promptDelivery: 'draft',
        launchSource: 'terminal_context_menu'
      })
    )
    expect(mockLaunchAiVaultSessionInNewTab).not.toHaveBeenCalled()
    expect(mockActivateAndRevealWorktree).toHaveBeenCalledWith('wt-fork', {
      sidebarRevealBehavior: 'auto',
      providesInitialSurface: true
    })
    expect(mockToast.success).toHaveBeenCalledWith('Session fork opened in a new child workspace')
  })

  it('offers the conversation for resume when the pane reports a forkable provider session', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'claude', providerSession: { key: 'session_id', id: 'sess-1' } }
    }
    const { prepareAgentSessionForkFromPane } = await import('./terminal-agent-session-fork')

    const prepared = prepareAgentSessionForkFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(prepared?.resume).toEqual({
      agent: 'claude',
      providerSession: { key: 'session_id', id: 'sess-1' },
      paneKey: PANE_KEY
    })
    expect(prepared?.defaultWorkspaceName).toBe('auth-feature-fork')
  })

  it.each([
    [
      'the agent cannot fork conversations',
      { agentType: 'dsh', providerSession: { key: 'session_id', id: 'sess-1' } }
    ],
    [
      'the provider session is only a restored guess',
      {
        agentType: 'claude',
        providerSession: { key: 'session_id', id: 'sess-1' },
        restoredUnconfirmed: true
      }
    ],
    ['no provider session was reported', { agentType: 'claude' }]
  ] satisfies [string, StatusEntry][])(
    'keeps context capture only when %s',
    async (_reason, entry) => {
      store.agentStatusByPaneKey = { [PANE_KEY]: entry }
      const { prepareAgentSessionForkFromPane } = await import('./terminal-agent-session-fork')

      const prepared = prepareAgentSessionForkFromPane({
        pane: makePane('User: compare OAuth options'),
        tabId: 'tab-1',
        worktreeId: 'wt-1',
        groupId: null
      })

      expect(prepared).not.toBeNull()
      expect(prepared?.resume).toBeUndefined()
    }
  )

  it('reads the provider session from a slept pane', async () => {
    store.sleepingAgentSessionsByPaneKey = {
      [PANE_KEY]: { agent: 'claude', providerSession: { key: 'session_id', id: 'sess-9' } }
    }
    store.tabsByWorktree = { 'wt-1': [{ id: 'tab-1', launchAgent: 'claude' }] }
    const { prepareAgentSessionForkFromPane } = await import('./terminal-agent-session-fork')

    const prepared = prepareAgentSessionForkFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(prepared?.resume?.providerSession).toEqual({ key: 'session_id', id: 'sess-9' })
  })

  it('continues the conversation in the fork workspace and sends the first message', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'claude', providerSession: { key: 'session_id', id: 'sess-1' } }
    }
    const { prepareAgentSessionForkFromPane, startAgentSessionFork } =
      await import('./terminal-agent-session-fork')
    const prepared = prepareAgentSessionForkFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    await expect(
      startAgentSessionFork(prepared!, {
        workspaceName: 'Auth Fork',
        firstMessage: ' now add the PKCE flow '
      })
    ).resolves.toBe(true)

    expect(mockCreateWorktree).toHaveBeenCalledWith(
      'repo-1',
      'auth-fork',
      'feature/auth',
      'inherit',
      undefined,
      'terminal_context_menu',
      'Auth Fork',
      undefined,
      undefined,
      undefined,
      'claude',
      ...Array(14).fill(undefined),
      FORK_OPTIONS
    )
    expect(mockActivateAndRevealWorktree).toHaveBeenCalledWith('wt-fork', {
      sidebarRevealBehavior: 'auto',
      providesInitialSurface: true
    })
    expect(mockLaunchAiVaultSessionInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'claude',
        worktreeId: 'wt-fork',
        command: expect.stringMatching(/--resume\W+sess-1\W+--fork-session/),
        launchSource: 'terminal_context_menu'
      })
    )
    expect(mockLaunchAiVaultSessionInNewTab.mock.calls[0]?.[0]).not.toHaveProperty(
      'providerSession'
    )
    expect(mockPasteAgentLaunchPromptOnceReady).toHaveBeenCalledWith({
      worktreeId: 'wt-fork',
      tabId: 'tab-2',
      agent: 'claude',
      content: 'now add the PKCE flow',
      submit: true,
      prompt: 'now add the PKCE flow'
    })
    expect(mockLaunchAgentInNewTab).not.toHaveBeenCalled()
    expect(mockWriteClipboardText).not.toHaveBeenCalled()
    expect(mockToast.success).toHaveBeenCalledWith(
      'Conversation continued in a new child workspace'
    )
  })

  it('leaves the forked agent waiting for input when the first message is empty', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'claude', providerSession: { key: 'session_id', id: 'sess-1' } }
    }
    const { prepareAgentSessionForkFromPane, startAgentSessionFork } =
      await import('./terminal-agent-session-fork')
    const prepared = prepareAgentSessionForkFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    await expect(startAgentSessionFork(prepared!, { firstMessage: '   ' })).resolves.toBe(true)

    expect(mockCreateWorktree.mock.calls[0]?.[1]).toBe('auth-feature-fork')
    expect(mockLaunchAiVaultSessionInNewTab).toHaveBeenCalledOnce()
    expect(mockPasteAgentLaunchPromptOnceReady).not.toHaveBeenCalled()
  })

  it("forks with the source pane's recorded launch args and env", async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'claude', providerSession: { key: 'session_id', id: 'sess-1' } }
    }
    store.getAgentLaunchConfigForStatusEntry.mockReturnValue({
      agentArgs: '--dangerously-skip-permissions',
      agentEnv: { ORCA_FORK_TEST: '1' }
    })
    const { prepareAgentSessionForkFromPane, startAgentSessionFork } =
      await import('./terminal-agent-session-fork')
    const prepared = prepareAgentSessionForkFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    await startAgentSessionFork(prepared!)

    expect(store.getAgentLaunchConfigForStatusEntry).toHaveBeenCalledWith(
      store.agentStatusByPaneKey[PANE_KEY]
    )
    const launch = mockLaunchAiVaultSessionInNewTab.mock.calls[0]?.[0]
    expect(launch.command).toContain('--dangerously-skip-permissions')
    expect(launch.command).toMatch(/--resume\W+sess-1\W+--fork-session/)
    expect(launch.env).toEqual(expect.objectContaining({ ORCA_FORK_TEST: '1' }))
  })

  it('hands the first message to the clipboard when a paired host owns the fork tab', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'claude', providerSession: { key: 'session_id', id: 'sess-1' } }
    }
    mockLaunchAiVaultSessionInNewTab.mockReturnValue({
      tabId: null,
      runtimeLaunch: Promise.resolve({ status: 'created' })
    })
    const { prepareAgentSessionForkFromPane, startAgentSessionFork } =
      await import('./terminal-agent-session-fork')
    const prepared = prepareAgentSessionForkFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    await expect(startAgentSessionFork(prepared!, { firstMessage: 'carry on' })).resolves.toBe(true)
    await vi.waitFor(() => expect(mockWriteClipboardText).toHaveBeenCalledWith('carry on'))
    expect(mockPasteAgentLaunchPromptOnceReady).not.toHaveBeenCalled()
  })

  it('appends the first message to the captured-context draft when nothing can be resumed', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'codex' }
    }
    const { prepareAgentSessionForkFromPane, startAgentSessionFork } =
      await import('./terminal-agent-session-fork')
    const prepared = prepareAgentSessionForkFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    await startAgentSessionFork(prepared!, { firstMessage: 'then wire the tests' })

    expect(mockLaunchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringMatching(/User: compare OAuth options[\s\S]*then wire the tests$/),
        promptDelivery: 'draft'
      })
    )
  })

  // The launcher publishes the paired-host surface; seeding reveal would add an unwanted sibling shell.
  it('reveals a paired fork without seeding a surface of its own', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'codex' }
    }
    mockLaunchAgentInNewTab.mockImplementationOnce(
      (args: { beforeSurfaceOpen?: (surface: { kind: 'host-published' }) => boolean }) => {
        args.beforeSurfaceOpen?.({ kind: 'host-published' })
        return {
          surface: { kind: 'host-published' },
          startupPlan: {},
          pasteDraftAfterLaunch: false
        }
      }
    )
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: 'group-1'
    })

    expect(mockActivateAndRevealWorktree).toHaveBeenCalledOnce()
    expect(mockActivateAndRevealWorktree).toHaveBeenCalledWith('wt-fork', {
      sidebarRevealBehavior: 'auto',
      providesInitialSurface: true
    })
  })

  it('waits for the destination and draft ownership before announcing the fork', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'codex' }
    }
    const destination = Promise.withResolvers<{ kind: 'structured'; sessionId: string }>()
    const draft = Promise.withResolvers<{
      delivered: boolean
      inComposer: boolean
      failureNotified: boolean
    }>()
    const result = {
      surface: { kind: 'host-published' },
      startupPlan: {},
      pasteDraftAfterLaunch: false,
      structuredSettlement: destination.promise,
      promptDeliveryResult: draft.promise
    }
    mockLaunchAgentInNewTab.mockImplementationOnce(
      (args: { beforeSurfaceOpen?: (surface: { kind: 'host-published' }) => void }) => {
        args.beforeSurfaceOpen?.({ kind: 'host-published' })
        return result
      }
    )
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    const forking = forkAgentSessionFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: 'group-1'
    })
    await vi.waitFor(() => expect(mockLaunchAgentInNewTab).toHaveBeenCalledOnce())
    expect(mockToast.success).not.toHaveBeenCalled()
    destination.resolve({ kind: 'structured', sessionId: 'fork-session' })
    await Promise.resolve()
    expect(mockToast.success).not.toHaveBeenCalled()
    draft.resolve({ delivered: false, inComposer: true, failureNotified: false })
    await forking
    expect(mockActivateAndRevealWorktree).toHaveBeenCalledWith('wt-fork', {
      sidebarRevealBehavior: 'auto',
      providesInitialSurface: true
    })
    expect(mockToast.success).toHaveBeenCalledWith('Session fork opened in a new child workspace')
  })

  it.each([
    ['failed', { kind: 'failed', error: new Error('boom') }, true],
    ['cancelled', { kind: 'cancelled', sessionId: 'session-1' }, true],
    ['visibility-unknown', { kind: 'visibility-unknown', sessionId: 'session-1' }, false]
  ])(
    'retains the committed workspace and copies context after a %s destination',
    async (_kind, settlement, _keepsOpen) => {
      store.agentStatusByPaneKey = {
        [PANE_KEY]: { agentType: 'codex' }
      }
      const result = {
        surface: { kind: 'host-published' },
        startupPlan: {},
        pasteDraftAfterLaunch: false,
        structuredSettlement: Promise.resolve(settlement)
      }
      mockLaunchAgentInNewTab.mockImplementationOnce(
        (args: { beforeSurfaceOpen?: (surface: { kind: 'host-published' }) => void }) => {
          args.beforeSurfaceOpen?.({ kind: 'host-published' })
          return result
        }
      )
      const { startAgentSessionFork, prepareAgentSessionForkFromPane } =
        await import('./terminal-agent-session-fork')

      const prepared = prepareAgentSessionForkFromPane({
        pane: makePane('User: compare OAuth options'),
        tabId: 'tab-1',
        worktreeId: 'wt-1',
        groupId: null
      })
      // Why: the worktree already exists; a false return would keep the dialog open for a second fork.
      await expect(startAgentSessionFork(prepared!)).resolves.toBe(true)
      expect(mockToast.success).not.toHaveBeenCalledWith(
        'Session fork opened in a new child workspace'
      )
      expect(mockWriteClipboardText).toHaveBeenCalledOnce()
      expect(mockActivateAndRevealWorktree).toHaveBeenCalledWith('wt-fork', {
        sidebarRevealBehavior: 'auto'
      })
    }
  )

  it('uses Linux startup quoting for SSH workspaces', async () => {
    store.repos = [{ id: 'repo-1', kind: 'git', connectionId: 'ssh-1' }]
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'codex' }
    }
    mockCreateWorktree.mockResolvedValueOnce({
      worktree: {
        id: 'wt-fork',
        path: '/home/u/repo/auth-feature-fork'
      }
    })
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(mockLaunchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'codex',
        worktreeId: 'wt-fork',
        launchPlatform: 'linux'
      })
    )
  })

  it('uses Linux startup quoting for WSL workspaces', async () => {
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'pi' }
    }
    mockCreateWorktree.mockResolvedValueOnce({
      worktree: {
        id: 'wt-fork',
        path: '\\\\wsl.localhost\\Ubuntu\\home\\u\\repo\\auth-feature-fork'
      }
    })
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(mockLaunchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'pi',
        worktreeId: 'wt-fork',
        launchPlatform: 'linux'
      })
    )
  })

  it('uses Linux startup quoting when a Windows-path project is forced to WSL', async () => {
    store.projects = [
      {
        id: 'repo-1',
        sourceRepoIds: ['repo-1'],
        localWindowsRuntimePreference: { kind: 'wsl', distro: 'Ubuntu' }
      }
    ]
    store.agentStatusByPaneKey = {
      [PANE_KEY]: { agentType: 'pi' }
    }
    mockCreateWorktree.mockResolvedValueOnce({
      worktree: {
        id: 'wt-fork',
        path: 'C:\\repo\\auth-feature-fork'
      }
    })
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane: makePane('User: compare OAuth options'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(mockLaunchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'pi',
        worktreeId: 'wt-fork',
        launchPlatform: 'linux'
      })
    )
  })

  it('creates a nested workspace fork and copies context when the source agent cannot be resolved', async () => {
    const pane = makePane('Assistant: here is the current plan')
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane,
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(mockCreateWorktree).toHaveBeenCalledWith(
      'repo-1',
      'auth-feature-fork',
      'feature/auth',
      'inherit',
      undefined,
      'terminal_context_menu',
      'Fork of auth-feature',
      undefined,
      undefined,
      undefined,
      undefined,
      ...Array(14).fill(undefined),
      FORK_OPTIONS
    )
    expect(mockLaunchAgentInNewTab).not.toHaveBeenCalled()
    expect(mockActivateAndRevealWorktree).toHaveBeenCalledWith('wt-fork', {
      sidebarRevealBehavior: 'auto'
    })
    expect(mockWriteClipboardText).toHaveBeenCalledWith(
      expect.stringContaining('Assistant: here is the current plan')
    )
    expect(mockToast.message).toHaveBeenCalledWith(
      'Fork context copied. Launch an agent and paste it to start the fork.'
    )
    expect(pane.terminal.focus).toHaveBeenCalled()
  })

  it("creates the fork through the source's server, not its SSH place", async () => {
    store.worktreesByRepo = {
      'repo-1': [
        { id: 'wt-1', repoId: 'repo-1', hostId: 'ssh:box', runtimeOwnerEnvironmentId: 'env-1' }
      ]
    }
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane: makePane('Assistant: plan'),
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(mockCreateWorktree.mock.calls[0]?.at(-1)).toEqual({
      executionHostId: 'runtime:env-1',
      parentWorktreeId: 'wt-1'
    })
  })

  it('keeps the fork dialog path open when the source workspace has no git branch', async () => {
    store.getKnownWorktreeById.mockReturnValue({
      id: 'wt-1',
      repoId: 'repo-1',
      displayName: 'scratch',
      branch: ''
    })
    const pane = makePane('User: summarize this scratch plan')
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane,
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      groupId: null
    })

    expect(mockCreateWorktree).not.toHaveBeenCalled()
    expect(mockLaunchAgentInNewTab).not.toHaveBeenCalled()
    expect(mockWriteClipboardText).not.toHaveBeenCalled()
    expect(mockToast.error).toHaveBeenCalledWith(
      'This workspace cannot be forked into a git worktree.'
    )
    expect(pane.terminal.focus).not.toHaveBeenCalled()
  })

  it('refuses to fork the floating terminal workspace', async () => {
    store.getKnownWorktreeById.mockReturnValue({
      id: FLOATING_TERMINAL_WORKTREE_ID,
      repoId: 'repo-1',
      displayName: 'floating',
      branch: 'main'
    })
    const { forkAgentSessionFromPane } = await import('./terminal-agent-session-fork')

    await forkAgentSessionFromPane({
      pane: makePane('User: anything'),
      tabId: 'tab-1',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      groupId: null
    })

    expect(mockCreateWorktree).not.toHaveBeenCalled()
    expect(mockToast.error).toHaveBeenCalledWith(
      'This workspace cannot be forked into a git worktree.'
    )
  })
})
