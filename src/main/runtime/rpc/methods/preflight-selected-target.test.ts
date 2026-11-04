import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OrcaRuntimeService,
  detectInstalledAgentsWithShellPathHydrationMock
} from '../../orca-runtime-test-mocks.spec'
import {
  makeFolderWorkspace,
  makeFolderProjectGroup,
  makeWorktreeMeta,
  store
} from '../../orca-runtime-test-fixtures.spec'
import { RpcDispatcher } from '../dispatcher'
import { PREFLIGHT_METHODS } from './preflight'
import type { Repo } from '../../../../shared/repo-types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { PREFLIGHT_RUNTIME_CAPABILITIES } from '../../../../shared/preflight-runtime-capabilities'
import type * as WorkspaceAgentDetection from '../../../preflight/workspace-agent-detection'

const { refresh, deliver } = vi.hoisted(() => ({
  deliver: vi.fn(async () => true),
  refresh: vi.fn(async () => ({
    agents: ['codex'],
    addedPathSegments: [],
    shellHydrationOk: true,
    pathSource: 'shell_hydrate',
    pathFailureReason: 'none'
  }))
}))
vi.mock('./agent-launch-terminal-prompt', () => ({ deliverTerminalAgentLaunchPrompt: deliver }))
// These ownership cases use a running distro; the stopped-distro contract is separate.
vi.mock('../../../wsl/discovery/wsl-background-exec-gate', () => ({
  assertWslDistroRunningForExec: async () => {},
  runAsWslExecUserAct: async (_distro: unknown, act: () => Promise<unknown>) => act()
}))
vi.mock('../../../preflight/workspace-agent-detection', async (original) => ({
  ...(await original<typeof WorkspaceAgentDetection>()),
  refreshAgentsOnHost: refresh
}))

const platform = process.platform
afterEach(() => {
  Object.defineProperty(process, 'platform', { configurable: true, value: platform })
  vi.restoreAllMocks()
})

describe('qualified discovery at the runtime RPC boundary', () => {
  it.each([false, true])(
    'retains the selected folder through path validation, startup and actual create (reverse=%s)',
    async (reverse) => {
      const path = await mkdtemp(join(tmpdir(), 'pr-31617-qualified-folder-'))
      try {
        const local = makeFolderWorkspace({ id: 'dup', folderPath: path, executionHostId: 'local' })
        const remote = {
          ...local,
          folderPath: '/unserved/remote',
          executionHostId: 'ssh:a%2Fb' as const
        }
        const folders = reverse ? [remote, local] : [local, remote]
        const runtime = new OrcaRuntimeService({
          ...store,
          getFolderWorkspaces: () => folders,
          getProjectGroups: () => [makeFolderProjectGroup()],
          getRepos: () => []
        })
        const spawn = vi.fn(async () => ({ id: 'pty-selected-folder' }))
        runtime.setPtyController({
          spawn,
          write: () => true,
          kill: () => true,
          getForegroundProcess: async () => null
        })
        const startup = vi.fn(() => ({
          agent: 'codex',
          startup: { command: 'codex', env: {}, startupCommandDelivery: 'none', telemetry: {} }
        }))
        Object.defineProperty(runtime, 'buildStartupForAgent', { value: startup })
        const selected = await runtime.resolveManagedTerminalWorkspaceTarget(
          'id:folder:dup',
          'local',
          false
        )
        if (!selected.managedWorktree || !selected.scope.folderWorkspace) {
          throw new Error('missing selected folder')
        }
        await runtime.launchAgentTerminal(
          'id:folder:dup',
          { agent: 'codex', prompt: 'Review' },
          {
            worktree: selected.managedWorktree,
            repo: store.getRepos()[0],
            folderWorkspace: selected.scope.folderWorkspace
          }
        )
        expect(startup).toHaveBeenCalledWith(
          expect.anything(),
          'codex',
          'Review',
          undefined,
          expect.objectContaining({
            launchScope: expect.objectContaining({
              path,
              connectionId: null,
              folderWorkspace: expect.objectContaining({ folderPath: path })
            })
          })
        )
        expect(spawn).toHaveBeenCalledWith(
          expect.objectContaining({
            cwd: path,
            connectionId: null,
            env: expect.objectContaining({ ORCA_WORKSPACE_ROOT: path })
          })
        )
        await expect(
          runtime.showManagedTerminalWorkspace('id:folder:dup', 'local')
        ).resolves.toMatchObject({ path, hostId: 'local' })
        const ssh = await runtime.resolveManagedTerminalWorkspaceTarget(
          'id:folder:dup',
          'ssh:a%2Fb',
          false
        )
        expect(ssh.scope).toMatchObject({ path: '/unserved/remote', connectionId: 'a/b' })
        await expect(
          runtime.showManagedTerminalWorkspace('id:folder:dup', 'ssh:a%2Fb')
        ).rejects.toThrow('folder_workspace_path_unavailable:/unserved/remote')
        folders.splice(folders.indexOf(local), 1)
        await expect(
          runtime.resolveManagedTerminalWorkspaceTarget('id:folder:dup', 'local', false)
        ).rejects.toThrow('selector_not_found')
        await expect(
          runtime.resolveManagedTerminalWorkspaceTarget('id:folder:dup', 'ssh:missing', false)
        ).rejects.toThrow('selector_not_found')
        expect(spawn).toHaveBeenCalledTimes(1)
      } finally {
        await rm(path, { recursive: true, force: true })
      }
    }
  )

  it('passes the selected project WSL override to refresh rather than the global distro', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    const local: Repo = {
      id: 'copy',
      path: 'C:\\same',
      kind: 'folder',
      displayName: 'Local',
      badgeColor: '#000',
      addedAt: 1
    }
    const runtime = new OrcaRuntimeService({
      ...store,
      getRepos: () => [{ ...local, connectionId: 'other' }, local],
      getSettings: () => ({
        ...store.getSettings(),
        localWindowsRuntimeDefault: { kind: 'wsl', distro: 'GlobalDistro' }
      }),
      getProjects: () => [
        {
          id: 'project',
          displayName: 'Project',
          badgeColor: '#000',
          sourceRepoIds: ['copy'],
          createdAt: 1,
          updatedAt: 1,
          localWindowsRuntimePreference: { kind: 'wsl', distro: 'ProjectDistro' }
        }
      ]
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: PREFLIGHT_METHODS })
    refresh.mockClear()
    expect(
      await dispatcher.dispatch({
        id: 'wsl',
        authToken: 'test',
        method: 'preflight.refreshAgents',
        params: { worktreeId: 'copy::C:\\same', worktreeHostId: 'local' }
      })
    ).toMatchObject({ ok: true })
    expect(refresh).toHaveBeenCalledWith({
      kind: 'local',
      context: {
        projectRuntime: expect.objectContaining({
          status: 'resolved',
          runtime: expect.objectContaining({ kind: 'wsl', distro: 'ProjectDistro' })
        })
      }
    })
  })
  it.each([false, true])(
    'uses the actual cold and warm folder-project instance in either repo order (reverse=%s)',
    async (reverse) => {
      const local: Repo = {
        id: 'copy',
        path: '/same',
        kind: 'folder',
        displayName: 'Local',
        badgeColor: '#000',
        addedAt: 1
      }
      const ssh: Repo = { ...local, connectionId: 'other' }
      const repos = reverse ? [ssh, local] : [local, ssh]
      const instanceId = '11111111-1111-4111-8111-111111111111'
      const worktreeId = `copy::/same::workspace:${instanceId}`
      const runtime = new OrcaRuntimeService({
        ...store,
        getRepos: () => repos,
        getAllWorktreeMeta: () => ({
          [worktreeId]: makeWorktreeMeta({ hostId: 'local', instanceId })
        })
      })
      const dispatcher = new RpcDispatcher({ runtime, methods: PREFLIGHT_METHODS })
      const call = (method: string, params: unknown) =>
        dispatcher.dispatch({ id: 'qualified', authToken: 'test', method, params })
      detectInstalledAgentsWithShellPathHydrationMock.mockReset().mockResolvedValue(['codex'])
      refresh.mockClear()
      for (const warm of [false, true]) {
        if (warm) {
          await runtime.listManagedWorktrees(undefined, 200)
        }
        expect(
          await call('preflight.detectAgents', { worktreeId, worktreeHostId: 'local' })
        ).toMatchObject({ ok: true, result: ['codex'] })
        expect(
          await call('preflight.refreshAgents', { worktreeId, worktreeHostId: 'local' })
        ).toMatchObject({ ok: true, result: { agents: ['codex'] } })
      }
      expect(refresh).toHaveBeenLastCalledWith({ kind: 'local', context: expect.anything() })
      const probes = detectInstalledAgentsWithShellPathHydrationMock.mock.calls.length
      for (const params of [
        { worktreeId: 'copy::/missing', worktreeHostId: 'local' },
        { worktreeId, worktreeHostId: 'ssh:absent' },
        { worktreeHostId: 'local' },
        { worktreeId, worktreeHostId: 'runtime:unresolved-owner' },
        { worktreeId: FLOATING_TERMINAL_WORKTREE_ID, worktreeHostId: 'local' }
      ]) {
        expect(await call('preflight.detectAgents', params)).toMatchObject({ ok: false })
      }
      expect(detectInstalledAgentsWithShellPathHydrationMock).toHaveBeenCalledTimes(probes)
      const shown = runtime.showManagedWorktree.bind(runtime)
      vi.spyOn(runtime, 'showManagedWorktree').mockImplementation(async (...args) => {
        const row = await shown(...args)
        repos.splice(repos.indexOf(local), 1)
        return row
      })
      expect(
        await call('preflight.refreshAgents', { worktreeId, worktreeHostId: 'local' })
      ).toMatchObject({ ok: false })
      expect(refresh).toHaveBeenCalledTimes(2)
      expect(PREFLIGHT_RUNTIME_CAPABILITIES).toContain('preflight.host-qualified.v1')
    }
  )

  it('proves unique saved-folder ownership and keeps valid local default semantics', async () => {
    const folder = makeFolderWorkspace({ executionHostId: 'local' })
    const ssh = { ...folder, executionHostId: 'ssh:other' as const }
    const folders = [ssh, folder]
    const runtime = new OrcaRuntimeService({
      ...store,
      getRepos: () => [],
      getFolderWorkspaces: () => folders,
      getProjectGroups: () => [makeFolderProjectGroup()]
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: PREFLIGHT_METHODS })
    detectInstalledAgentsWithShellPathHydrationMock.mockReset().mockResolvedValue(['codex'])
    const params = { worktreeId: `folder:${folder.id}`, worktreeHostId: 'local' }
    const call = () =>
      dispatcher.dispatch({
        id: 'folder',
        authToken: 'test',
        method: 'preflight.detectAgents',
        params
      })
    expect(await call()).toMatchObject({ ok: true, result: ['codex'] })
    expect(detectInstalledAgentsWithShellPathHydrationMock).toHaveBeenLastCalledWith(
      undefined,
      undefined
    )
    folders.splice(1, 1)
    expect(await call()).toMatchObject({ ok: false })
    folders.push(folder, { ...folder })
    expect(await call()).toMatchObject({ ok: false })
    expect(detectInstalledAgentsWithShellPathHydrationMock).toHaveBeenCalledTimes(1)
  })
})
