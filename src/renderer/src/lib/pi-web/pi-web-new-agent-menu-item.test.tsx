// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorktreeOperationRouteState } from '@/lib/worktree-operation-route'
import type { ExecutionHostId } from '../../../../shared/execution-host'

const { store, openPiWebNew } = vi.hoisted(() => {
  const holder: { state: Record<string, unknown> } = { state: {} }
  return { store: holder, openPiWebNew: vi.fn(async (_worktreeId: string) => {}) }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector(store.state)
}))
vi.mock('./open-pi-web', () => ({ openPiWebNew }))

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { PiWebNewAgentMenuItem } from './pi-web-new-agent-menu-item'

const WORKTREE_ID = 'repo-1::/srv/worktree'

function workspaceOn(hostId: ExecutionHostId | undefined, repo: Record<string, unknown> = {}) {
  const state: WorktreeOperationRouteState = {
    repos: [{ id: 'repo-1', connectionId: null, ...repo }],
    worktreesByRepo: { 'repo-1': [{ id: WORKTREE_ID, repoId: 'repo-1', hostId }] }
  }
  store.state = { ...state }
}

function renderItem(): void {
  render(
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger>New</DropdownMenuTrigger>
      <DropdownMenuContent>
        <PiWebNewAgentMenuItem worktreeId={WORKTREE_ID} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const piWebRow = () => screen.queryByRole('menuitem', { name: 'pi-web' })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Reflect.deleteProperty(globalThis, '__ORCA_WEB_CLIENT__')
})

describe('PiWebNewAgentMenuItem', () => {
  it('menu item shown for local workspace', () => {
    workspaceOn('local', { executionHostId: 'local' })
    renderItem()
    const row = piWebRow()
    expect(row).not.toBeNull()
    fireEvent.click(row!)
    expect(openPiWebNew).toHaveBeenCalledWith(WORKTREE_ID)
  })

  it('menu item hidden when the integration is off', async () => {
    workspaceOn('local', { executionHostId: 'local' })
    store.state = { ...store.state, settings: { piWeb: { enabled: false } } }
    renderItem()
    expect(piWebRow()).toBeNull()
    cleanup()

    // ORCA_PI_WEB_ENABLED=0 wins over a stored "on", once main reports the effective config.
    store.state = { ...store.state, settings: { piWeb: { enabled: true } } }
    vi.stubGlobal(
      'window',
      Object.assign(window, {
        api: {
          piWeb: {
            getEffectiveConfig: vi.fn(async () => ({
              config: { enabled: false },
              envOverrides: { enabled: 'ORCA_PI_WEB_ENABLED' }
            }))
          }
        }
      })
    )
    try {
      renderItem()
      await waitFor(() => expect(piWebRow()).toBeNull())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('menu item hidden for ssh workspace', () => {
    workspaceOn('ssh:ssh-1', { connectionId: 'ssh-1', executionHostId: 'ssh:ssh-1' })
    renderItem()
    expect(piWebRow()).toBeNull()
  })

  it('menu item hidden for runtime-owned workspace and in a web client window', () => {
    workspaceOn('runtime:hub-a')
    renderItem()
    expect(piWebRow()).toBeNull()
    cleanup()

    workspaceOn('local', { executionHostId: 'local' })
    Reflect.set(globalThis, '__ORCA_WEB_CLIENT__', true)
    renderItem()
    expect(piWebRow()).toBeNull()
  })
})
