// Use the real store, policy and surface so broken wiring cannot pass on mocked sink call counts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setPresenceGated } from '@/hooks/agent-auto-ack-presence'
import { getDefaultSettings } from '../../../../shared/constants'
import { getDefaultNotificationSettings } from '../../../../shared/notification-settings-defaults'
import type { NotificationDispatchRequest } from '../../../../shared/notification-settings-types'
import { piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { PiWebAttentionEvent } from '../../../../shared/pi-web/pi-web-status-types'
import { createTestStore, makeWorktree, TEST_REPO } from '@/store/slices/store-test-helpers'
import { forgetPiWebRow, rememberPiWebRow } from './pi-web-row-registry'

beforeEach(() => setPresenceGated(false))
afterEach(() => setPresenceGated(true))

vi.mock('@/store', () => ({ useAppStore: { getState: () => store.getState() } }))
vi.mock('@/lib/desktop-notification-sound', () => ({
  playDesktopNotificationSound: vi.fn(async () => false)
}))
vi.mock('@/lib/blocked-notification-fallback', () => ({
  showBlockedNotificationFallbackToast: vi.fn()
}))

const store = createTestStore()
const dispatched: NotificationDispatchRequest[] = []

const { dispatchPiWebAttention } = await import('./pi-web-attention-dispatch')

const WORKSPACE = 'repo1::/tmp/wt'
const SESSION = 'session-1'

function seed(overrides?: { cliCreated?: boolean; notifyHiddenWorkspaces?: boolean }): void {
  store.setState({
    repos: [TEST_REPO],
    worktreesByRepo: {
      repo1: [
        makeWorktree({
          id: WORKSPACE,
          repoId: 'repo1',
          ...(overrides?.cliCreated
            ? { cliProvenance: { kind: 'created-by-cli', createdAt: 0 } }
            : {})
        })
      ]
    },
    folderWorkspaces: [],
    activeView: 'terminal',
    activeWorktreeId: 'other-workspace',
    unreadTerminalTabs: {},
    unreadTerminalPanes: {},
    unreadAgentCompletionPanes: {},
    persistedUIReady: true,
    workspaceSessionReady: true,
    hideCliCreatedWorkspaces: true,
    settings: {
      ...getDefaultSettings('/tmp'),
      notifications: {
        ...getDefaultNotificationSettings(),
        notifyHiddenWorkspaces: overrides?.notifyHiddenWorkspaces ?? true
      }
    }
  })
  rememberPiWebRow({
    sessionId: SESSION,
    worktreeId: WORKSPACE,
    cwd: '/tmp/wt',
    name: 'Fix the flaky test',
    state: 'done',
    stateStartedAt: 1000,
    updatedAt: 2000
  })
}

function event(overrides?: Partial<PiWebAttentionEvent>): PiWebAttentionEvent {
  return {
    sessionId: SESSION,
    worktreeId: WORKSPACE,
    name: 'Fix the flaky test',
    kind: 'completed',
    ...overrides
  }
}

function workspaceBold(): boolean {
  return store.getState().worktreesByRepo.repo1?.[0]?.isUnread === true
}

describe('dispatchPiWebAttention', () => {
  beforeEach(() => {
    dispatched.length = 0
    vi.stubGlobal('window', {
      api: {
        notifications: {
          dispatch: async (request: NotificationDispatchRequest) => {
            dispatched.push(request)
            return { delivered: true }
          }
        }
      }
    })
    seed()
  })

  afterEach(() => {
    forgetPiWebRow(SESSION)
    vi.unstubAllGlobals()
  })

  it('completed event requests a done notification on the pi-web surface', () => {
    dispatchPiWebAttention(event())

    expect(dispatched).toEqual([
      {
        source: 'agent-task-complete',
        surface: 'pi-web',
        piWebSessionId: SESSION,
        agentType: 'pi-web',
        agentState: 'done',
        paneKey: piWebPaneKey(SESSION),
        worktreeId: WORKSPACE,
        terminalTitle: 'Fix the flaky test',
        // pi-web pushes its own phones; Orca must not fan the same alert out again.
        mobileDeliveredByHost: true,
        isActiveWorktree: false,
        notificationSourceId: 'local',
        repoLabel: 'Repo 1',
        worktreeLabel: 'feature'
      }
    ])
    expect(workspaceBold()).toBe(true)
    expect(store.getState().unreadAgentCompletionPanes[piWebPaneKey(SESSION)]).toBe(
      'agent-completion'
    )
  })

  it('needs-input requests a blocked notification', () => {
    dispatchPiWebAttention(event({ kind: 'needs-input', name: null }))

    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]).toMatchObject({
      source: 'agent-task-complete',
      surface: 'pi-web',
      piWebSessionId: SESSION,
      agentState: 'blocked',
      terminalTitle: 'pi-web',
      mobileDeliveredByHost: true
    })
  })

  it('muted workspace requests no delivery', () => {
    seed({ cliCreated: true, notifyHiddenWorkspaces: false })

    dispatchPiWebAttention(event())
    dispatchPiWebAttention(event({ kind: 'needs-input' }))

    expect(dispatched).toEqual([])
    expect(workspaceBold()).toBe(false)
  })

  it('drops a completion whose row the registry no longer knows', () => {
    forgetPiWebRow(SESSION)

    dispatchPiWebAttention(event())

    expect(dispatched).toEqual([])
    expect(workspaceBold()).toBe(false)
  })

  it('marks no unread while the workspace is on screen, but still asks main to deliver', () => {
    store.setState({ activeWorktreeId: WORKSPACE })

    dispatchPiWebAttention(event())

    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]?.isActiveWorktree).toBe(true)
    expect(workspaceBold()).toBe(false)
  })
})
