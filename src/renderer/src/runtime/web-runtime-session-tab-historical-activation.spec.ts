import { expect, it, vi } from 'vitest'
import { activateWebRuntimeSessionTab } from './web-runtime-session-tab-lifecycle'
import {
  getRuntimeEnvironmentRevision,
  replaceRuntimeEnvironmentRevisions
} from './runtime-environment-revision'
import { peekWebSessionFocusIntent } from './web-session-focus-intent'
import { activateTerminalTabOnOwner } from '@/lib/terminal-tab-owner-activation'
import type { LegacyRelayBridgedPane } from '../../../shared/legacy-relay-bridge-contract'
import { stubRuntimeEnvironmentBridge } from './runtime-environment-bridge-fixture'

export function registerHistoricalSessionTabActivationTests(
  _mocks: {
    getState: ReturnType<typeof vi.fn>
    subscribe: ReturnType<typeof vi.fn>
    revealWorktree: ReturnType<typeof vi.fn>
  },
  { ENVIRONMENT_ID, WORKTREE_ID }: { ENVIRONMENT_ID: string; WORKTREE_ID: string }
): void {
  it('historical owner focus keeps a live legacy-relay pane without asking the server for a second shell', async () => {
    const runtimeCall = vi.fn()
    const listeners = new Set<(panes: LegacyRelayBridgedPane[]) => void>()
    const bridged: LegacyRelayBridgedPane = {
      ptyId: 'ssh:box@@recorded-pty',
      targetId: 'box',
      tabId: 'recorded-tab',
      leafId: 'recorded-leaf',
      state: 'live'
    }
    vi.stubGlobal('window', {
      api: {
        runtimeEnvironments: { call: runtimeCall },
        legacyRelayBridge: {
          listPanes: async () => [bridged],
          onPanes: (listener: (panes: LegacyRelayBridgedPane[]) => void) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          }
        }
      }
    })
    const { legacyRelayBridgedPanesListed } =
      await import('../components/terminal-pane/legacy-relay-bridge-panes')
    await legacyRelayBridgedPanesListed()
    activateTerminalTabOnOwner(
      WORKTREE_ID,
      'web-terminal-recorded-tab',
      'recorded-leaf',
      ENVIRONMENT_ID
    )
    await expect(
      activateWebRuntimeSessionTab({
        worktreeId: WORKTREE_ID,
        tabId: 'web-terminal-recorded-tab',
        leafId: 'recorded-leaf',
        environmentId: ENVIRONMENT_ID
      })
    ).resolves.toBe(true)
    await vi.waitFor(() =>
      expect(peekWebSessionFocusIntent({ environmentId: ENVIRONMENT_ID }, WORKTREE_ID)).toBeNull()
    )
    expect(runtimeCall).not.toHaveBeenCalled()
    listeners.forEach((listener) => listener([]))
  })

  it('historical owner focus does not adopt a new pairing while awaiting relay discovery', async () => {
    replaceRuntimeEnvironmentRevisions([{ id: ENVIRONMENT_ID, pairingRevision: 4, createdAt: 1 }])
    const runtimeCall = vi.fn(async (request: { expectedEnvironmentPairingRevision?: number }) =>
      request.expectedEnvironmentPairingRevision === getRuntimeEnvironmentRevision(ENVIRONMENT_ID)
        ? { id: 'activate', ok: true, result: {} }
        : {
            id: 'activate',
            ok: false,
            error: { code: 'runtime_environment_changed', message: 'Pairing changed' }
          }
    )
    stubRuntimeEnvironmentBridge({ call: runtimeCall })
    const pending = activateWebRuntimeSessionTab({
      worktreeId: WORKTREE_ID,
      tabId: 'recorded-tab',
      leafId: 'recorded-leaf',
      environmentId: ENVIRONMENT_ID,
      expectedPairingRevision: 4
    })
    replaceRuntimeEnvironmentRevisions([{ id: ENVIRONMENT_ID, pairingRevision: 5, createdAt: 1 }])
    await expect(pending).resolves.toBe(false)
    for (const [request] of runtimeCall.mock.calls) {
      expect(request.expectedEnvironmentPairingRevision).toBe(4)
    }
  })
}
