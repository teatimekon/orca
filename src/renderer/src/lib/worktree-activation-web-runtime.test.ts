import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../../shared/setup-agent-sequencing'
import './worktree-activation'
import { ensureWorktreeHasInitialTerminal } from './worktree-initial-terminal-seeding'
import type { AppStoreState } from './worktree-activation.test-fixture'
import {
  createMockStore,
  registerWorktreeActivationReset
} from './worktree-activation.test-fixture'
import { useAppStore } from '@/store'
import { resetWebRuntimeWakeTerminalRespawnForTests } from '@/runtime/web-runtime-wake-terminal-respawn'
import '../runtime/runtime-environment-bridge-fixture'
import '@/runtime/web-session-tabs-sync/host-terminal-count-fixture'
import { resetWebSessionTabsSnapshotFreshnessForTests } from '@/runtime/web-session-tabs-sync/tracking-lifecycle'

registerWorktreeActivationReset()
const originalCreateTab = useAppStore.getState().createTab
const originalSetActiveWorktree = useAppStore.getState().setActiveWorktree

afterEach(() => {
  useAppStore.setState({
    createTab: originalCreateTab,
    setActiveWorktree: originalSetActiveWorktree
  })
  vi.unstubAllGlobals()
  resetWebRuntimeWakeTerminalRespawnForTests()
  resetWebSessionTabsSnapshotFreshnessForTests()
})

describe('ensureWorktreeHasInitialTerminal', () => {
  it('holds the issue command for the first mirrored web runtime tab when none exists yet', () => {
    ;(globalThis as { __ORCA_WEB_CLIENT__?: boolean }).__ORCA_WEB_CLIENT__ = true
    useAppStore.setState((state) => ({
      settings: state.settings
        ? { ...state.settings, activeRuntimeEnvironmentId: 'web-runtime-1' }
        : ({ activeRuntimeEnvironmentId: 'web-runtime-1' } as unknown as typeof state.settings),
      worktreesByRepo: {
        'repo-1': [
          {
            id: 'wt-1',
            repoId: 'repo-1',
            hostId: 'local',
            runtimeOwnerEnvironmentId: 'web-runtime-1'
          }
        ] as never
      }
    }))
    useAppStore.setState({
      tabsByWorktree: {},
      getKnownWorktreeById: ((id: string) =>
        id === 'wt-1'
          ? { id: 'wt-1' }
          : undefined) as unknown as AppStoreState['getKnownWorktreeById']
    } as Partial<AppStoreState>)
    const store = createMockStore()

    const result = ensureWorktreeHasInitialTerminal(store, 'wt-1', undefined, undefined, {
      command: 'gh issue view 42'
    })

    // Why: runtime session tabs mirror in asynchronously — the command must be
    // held for the first mirrored tab rather than silently dropped.
    expect(result).toBeNull()
    expect(useAppStore.getState().pendingIssueCommandSplitByTabId).toEqual({})

    useAppStore.setState({
      tabsByWorktree: { 'wt-1': [{ id: 'mirror-tab-1' }] }
    } as unknown as Partial<AppStoreState>)

    expect(useAppStore.getState().pendingIssueCommandSplitByTabId['mirror-tab-1']).toEqual({
      command: 'gh issue view 42'
    })
  })

  it('does not create a fallback while a backend startup terminal awaits mirroring', () => {
    useAppStore.setState({
      getKnownWorktreeById: ((id: string) =>
        id === 'wt-1'
          ? { id: 'wt-1' }
          : undefined) as unknown as AppStoreState['getKnownWorktreeById']
    } as Partial<AppStoreState>)
    const store = createMockStore()

    const result = ensureWorktreeHasInitialTerminal(
      store,
      'wt-1',
      undefined,
      undefined,
      { command: 'gh issue view 42' },
      undefined,
      { backendStartupTerminalSpawned: true }
    )

    expect(result).toBeNull()
    expect(store.createTab).not.toHaveBeenCalled()
    expect(store.setActiveTab).not.toHaveBeenCalled()

    useAppStore.setState({
      tabsByWorktree: { 'wt-1': [{ id: 'mirror-tab-1' }] }
    } as unknown as Partial<AppStoreState>)

    expect(useAppStore.getState().pendingIssueCommandSplitByTabId['mirror-tab-1']).toEqual({
      command: 'gh issue view 42'
    })
  })
})
