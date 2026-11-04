// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { registerWorkspaceShortcutIpcBridge } from './workspace-shortcut-ipc-bridge'

describe('workspace shortcut bridge in the pure build', () => {
  it('does not subscribe to the agent dashboard shortcut', () => {
    const fns = new Map<string, ReturnType<typeof vi.fn>>()
    const ui = new Proxy(
      {},
      {
        get: (_target, key: string) => {
          if (!fns.has(key)) {
            fns.set(
              key,
              vi.fn(() => () => {})
            )
          }
          return fns.get(key)
        }
      }
    )
    vi.stubGlobal('window', Object.assign(window, { api: { ui } }))
    const unsubs: (() => void)[] = []
    registerWorkspaceShortcutIpcBridge(unsubs)
    expect(fns.get('onOpenQuickOpen')).toHaveBeenCalled()
    expect(fns.get('onToggleAgentDashboard')).toBeUndefined()
  })
})
