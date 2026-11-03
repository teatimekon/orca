import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDispatchHandler,
  getNotificationEventHandler,
  getTrustedUIRendererWindowMock,
  resetNotificationDispatchMocks
} from './notifications-test-harness'

vi.mock('electron', async () =>
  (await import('./notifications-test-harness')).createElectronModuleMock()
)

vi.mock('./notification-authorization-status', async () =>
  (await import('./notifications-test-harness')).createNotificationAuthorizationModuleMock()
)

vi.mock('./ui', async () =>
  (await import('./notifications-test-harness')).createTrustedUIRendererModuleMock()
)

vi.mock('../tray/system-tray', async () =>
  (await import('./notifications-test-harness')).createSystemTrayModuleMock()
)

import { registerNotificationHandlers } from './notifications'
import { piWebPaneKey } from '../../shared/pi-web/pi-web-pane-key'
import { PI_WEB_IPC } from '../../shared/pi-web/pi-web-status-types'

beforeEach(() => {
  vi.stubEnv('ORCA_BACKGROUND_LAUNCH', undefined)
  vi.stubEnv('ORCA_E2E_HEADLESS', undefined)
  vi.stubEnv('ORCA_E2E_HEADFUL', undefined)
})
afterEach(() => vi.unstubAllEnvs())

function trustedWindowSend(): ReturnType<typeof vi.fn> {
  const webContentsSend = vi.fn()
  getTrustedUIRendererWindowMock.mockReturnValue({
    isDestroyed: () => false,
    isFocused: () => false,
    isMinimized: () => false,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    webContents: { send: webContentsSend }
  })
  return webContentsSend
}

function registerHandlers(): void {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers read only getSettings().notifications in these tests.
  registerNotificationHandlers({
    getSettings: () => ({
      notifications: {
        enabled: true,
        agentTaskComplete: true,
        agentNeedsInput: true,
        terminalBell: true,
        suppressWhenFocused: true,
        mutedNotificationSourceIds: []
      }
    })
  } as never)
}

describe('pi-web notification click', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T16:00:00Z'))
    resetNotificationDispatchMocks()
  })

  it('pi-web click opens session', async () => {
    const webContentsSend = trustedWindowSend()
    registerHandlers()

    expect(
      await getDispatchHandler()(
        {},
        {
          source: 'agent-task-complete',
          surface: 'pi-web',
          piWebSessionId: 'session-1',
          agentType: 'pi-web',
          agentState: 'done',
          worktreeId: 'repo::wt1',
          paneKey: piWebPaneKey('session-1'),
          mobileDeliveredByHost: true
        }
      )
    ).toEqual({ delivered: true })

    getNotificationEventHandler('click')()

    // The placeholder pane key names no terminal, so only activation and the session open may follow.
    expect(webContentsSend.mock.calls).toEqual([
      ['ui:activateWorktree', { repoId: 'repo', worktreeId: 'repo::wt1' }],
      [PI_WEB_IPC.openSession, { worktreeId: 'repo::wt1', sessionId: 'session-1' }]
    ])
  })

  it('binds the click for a folder workspace, whose id carries no repo to activate', async () => {
    const webContentsSend = trustedWindowSend()
    registerHandlers()

    await getDispatchHandler()(
      {},
      {
        source: 'agent-task-complete',
        surface: 'pi-web',
        piWebSessionId: 'session-2',
        agentType: 'pi-web',
        agentState: 'blocked',
        worktreeId: 'folder:fw-1',
        mobileDeliveredByHost: true
      }
    )
    getNotificationEventHandler('click')()

    expect(webContentsSend.mock.calls).toEqual([
      [PI_WEB_IPC.openSession, { worktreeId: 'folder:fw-1', sessionId: 'session-2' }]
    ])
  })
})
