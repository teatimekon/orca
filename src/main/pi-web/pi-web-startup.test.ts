import { afterEach, describe, expect, it, vi } from 'vitest'

const { bridgeStart, registerHandlers } = vi.hoisted(() => ({
  bridgeStart: vi.fn(),
  registerHandlers: vi.fn()
}))

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/orca-dev-test' } }))
vi.mock('../ipc/ui', () => ({ getTrustedUIRendererWindow: () => null }))
vi.mock('./pi-web-ipc', () => ({ registerPiWebIpcHandlers: registerHandlers }))
vi.mock('./pi-web-bridge', () => ({
  PiWebBridge: class {
    start = bridgeStart
  }
}))

const { startPiWebBridge } = await import('./pi-web-startup')

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the startup reads only getSettings and onSettingsChanged.
const store = { getSettings: () => ({}), onSettingsChanged: () => () => {} } as never

describe('startPiWebBridge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    bridgeStart.mockReset()
    registerHandlers.mockReset()
  })

  it('starts the bridge and registers its IPC handlers', () => {
    expect(startPiWebBridge(store)).not.toBeNull()
    expect(bridgeStart).toHaveBeenCalledTimes(1)
    expect(registerHandlers).toHaveBeenCalledTimes(1)
  })

  it('a bridge that fails to start is logged and Orca keeps starting', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    bridgeStart.mockImplementation(() => {
      throw new TypeError("Cannot read properties of null (reading 'startsWith')")
    })
    expect(() => startPiWebBridge(store)).not.toThrow()
    expect(startPiWebBridge(store)).toBeNull()
    expect(error).toHaveBeenCalledWith(
      '[pi-web] status bridge failed to start',
      expect.any(TypeError)
    )
  })
})
