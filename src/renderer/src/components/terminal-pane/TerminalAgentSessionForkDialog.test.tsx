import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreparedAgentSessionFork } from './terminal-agent-session-fork'

type CapturedButtonProps = {
  disabled?: boolean
  onClick?: () => void
  children?: React.ReactNode
}

const mocks = vi.hoisted(() => ({
  buttons: [] as CapturedButtonProps[],
  copyAgentSessionForkContext: vi.fn(),
  startAgentSessionFork: vi.fn()
}))

vi.mock('@/components/ui/button', async () => {
  const ReactModule = await import('react')
  return {
    Button: (props: CapturedButtonProps) => {
      mocks.buttons.push(props)
      return ReactModule.createElement('button', { disabled: props.disabled }, props.children)
    }
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const ReactModule = await import('react')
  return {
    Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
      open ? ReactModule.createElement('div', null, children) : null,
    DialogContent: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('div', null, children),
    DialogDescription: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('p', null, children),
    DialogFooter: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('footer', null, children),
    DialogHeader: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('header', null, children),
    DialogTitle: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('h2', null, children)
  }
})

vi.mock('./terminal-agent-session-fork', () => ({
  copyAgentSessionForkContext: mocks.copyAgentSessionForkContext,
  startAgentSessionFork: mocks.startAgentSessionFork
}))

function makeFork(overrides: Partial<PreparedAgentSessionFork> = {}): PreparedAgentSessionFork {
  return {
    prompt: 'fork prompt',
    agent: null,
    worktreeId: 'wt-1',
    focusSource: vi.fn(),
    defaultWorkspaceName: 'auth-feature-fork',
    ...overrides
  }
}

describe('TerminalAgentSessionForkDialog', () => {
  beforeEach(() => {
    mocks.buttons = []
    mocks.copyAgentSessionForkContext.mockReset()
    mocks.startAgentSessionFork.mockReset()
  })

  it('prevents busy-state double submit for create', async () => {
    mocks.startAgentSessionFork.mockReturnValue(new Promise(() => undefined))
    const { TerminalAgentSessionForkDialog } = await import('./TerminalAgentSessionForkDialog')

    renderToStaticMarkup(
      <TerminalAgentSessionForkDialog open fork={makeFork()} onOpenChange={vi.fn()} />
    )

    const createButton = mocks.buttons[1]
    expect(createButton).toBeDefined()

    createButton?.onClick?.()
    createButton?.onClick?.()

    expect(mocks.startAgentSessionFork).toHaveBeenCalledTimes(1)
  })

  it('creates the fork with the suggested workspace name and no first message', async () => {
    mocks.startAgentSessionFork.mockResolvedValue(true)
    const fork = makeFork()
    const { TerminalAgentSessionForkDialog } = await import('./TerminalAgentSessionForkDialog')

    const markup = renderToStaticMarkup(
      <TerminalAgentSessionForkDialog open fork={fork} onOpenChange={vi.fn()} />
    )

    expect(markup).toContain('value="auth-feature-fork"')
    mocks.buttons[1]?.onClick?.()
    expect(mocks.startAgentSessionFork).toHaveBeenCalledWith(fork, {
      workspaceName: 'auth-feature-fork',
      firstMessage: ''
    })
  })

  it('keeps create disabled until the workspace name slugs to something', async () => {
    const { TerminalAgentSessionForkDialog } = await import('./TerminalAgentSessionForkDialog')

    renderToStaticMarkup(
      <TerminalAgentSessionForkDialog
        open
        fork={makeFork({ defaultWorkspaceName: '' })}
        onOpenChange={vi.fn()}
      />
    )

    expect(mocks.buttons[1]?.disabled).toBe(true)
    mocks.buttons[1]?.onClick?.()
    expect(mocks.startAgentSessionFork).not.toHaveBeenCalled()
  })

  it('explains the resume command when the conversation can be forked', async () => {
    const { TerminalAgentSessionForkDialog } = await import('./TerminalAgentSessionForkDialog')

    const markup = renderToStaticMarkup(
      <TerminalAgentSessionForkDialog
        open
        fork={makeFork({
          agent: 'claude',
          resume: {
            agent: 'claude',
            providerSession: { key: 'session_id', id: 'sess-1' },
            paneKey: 'tab-1:leaf-1'
          }
        })}
        onOpenChange={vi.fn()}
      />
    )

    expect(markup).toContain('Continue this conversation')
    expect(markup).toContain('claude --resume sess-1 --fork-session')
    expect(markup).not.toContain('Captured context only')
  })

  it('announces the captured-context fallback when nothing can be resumed', async () => {
    const { TerminalAgentSessionForkDialog } = await import('./TerminalAgentSessionForkDialog')

    const markup = renderToStaticMarkup(
      <TerminalAgentSessionForkDialog open fork={makeFork()} onOpenChange={vi.fn()} />
    )

    expect(markup).toContain('Captured context only')
    expect(markup).not.toContain('Continue this conversation')
  })
})
