// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRepoLabels, useRepoAssignees } from './useGitHubRepoMetadata'

const runtimeMocks = vi.hoisted(() => ({ callRuntimeRpc: vi.fn() }))
const githubMocks = vi.hoisted(() => ({ listLabels: vi.fn(), listAssignableUsers: vi.fn() }))

vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: runtimeMocks.callRuntimeRpc }))

const roots: Root[] = []

function installWindowApi(): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      gh: {
        listLabels: githubMocks.listLabels,
        listAssignableUsers: githubMocks.listAssignableUsers
      }
    }
  })
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function renderProbe(element: React.ReactNode): void {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => {
    root.render(element)
  })
}

describe('useIssueMetadata hooks', () => {
  beforeEach(() => {
    runtimeMocks.callRuntimeRpc.mockReset()
    githubMocks.listLabels.mockReset()
    githubMocks.listAssignableUsers.mockReset()
    installWindowApi()
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount())
    })
    document.body.replaceChildren()
  })

  it('keeps concurrent fork and upstream label lists separate when the fork reply is late', async () => {
    const fork = { owner: 'fork', repo: 'widgets', host: 'github.com' }
    const upstream = { owner: 'upstream', repo: 'widgets', host: 'github.com' }
    let finishFork: (labels: string[]) => void = () => {}
    const forkReply = new Promise<string[]>((resolve) => {
      finishFork = resolve
    })
    githubMocks.listLabels.mockImplementation(({ ownerRepo }) =>
      ownerRepo.owner === 'fork' ? forkReply : Promise.resolve(['upstream-label'])
    )
    let forkLabels: string[] = []
    let upstreamLabels: string[] = []
    function Probe(): null {
      forkLabels = useRepoLabels(null, 'concurrent-folder', { ownerRepo: fork }).data
      upstreamLabels = useRepoLabels(null, 'concurrent-folder', { ownerRepo: upstream }).data
      return null
    }
    renderProbe(<Probe />)
    await flushEffects()
    expect(forkLabels).toEqual([])
    expect(upstreamLabels).toEqual(['upstream-label'])
    await act(async () => {
      finishFork(['fork-label'])
    })
    await flushEffects()
    expect(forkLabels).toEqual(['fork-label'])
    expect(upstreamLabels).toEqual(['upstream-label'])
    expect(githubMocks.listLabels).toHaveBeenCalledTimes(2)
  })

  it('ignores a late fork assignee reply after the opened issue switches to upstream', async () => {
    const fork = { owner: 'fork', repo: 'widgets', host: 'github.com' }
    const upstream = { owner: 'upstream', repo: 'widgets', host: 'github.com' }
    let finishFork: (users: { login: string; name: null; avatarUrl: string }[]) => void = () => {}
    const forkReply = new Promise<{ login: string; name: null; avatarUrl: string }[]>((resolve) => {
      finishFork = resolve
    })
    githubMocks.listAssignableUsers.mockImplementation(({ ownerRepo }) =>
      ownerRepo.owner === 'fork'
        ? forkReply
        : Promise.resolve([{ login: 'upstream-user', name: null, avatarUrl: '' }])
    )
    let logins: string[] = []
    function Probe({ ownerRepo }: { ownerRepo: typeof fork }): null {
      logins = useRepoAssignees(null, 'switch-folder', { ownerRepo }).data.map((user) => user.login)
      return null
    }
    renderProbe(<Probe ownerRepo={fork} />)
    await flushEffects()
    const root = roots.at(-1)
    if (!root) {
      throw new Error('Expected the rendered probe')
    }
    act(() => root.render(<Probe ownerRepo={upstream} />))
    await flushEffects()
    expect(logins).toEqual(['upstream-user'])
    await act(async () => {
      finishFork([{ login: 'fork-user', name: null, avatarUrl: '' }])
    })
    await flushEffects()
    expect(logins).toEqual(['upstream-user'])
    expect(githubMocks.listAssignableUsers).toHaveBeenCalledTimes(2)
  })

  it('prefers an explicit remote environment and repo id', async () => {
    let labels: string[] = []
    runtimeMocks.callRuntimeRpc.mockResolvedValue(['remote'])

    function LabelsProbe(): null {
      labels = useRepoLabels('/local/repo', 'remote-repo-id', {
        target: { kind: 'environment', environmentId: 'env-explicit' }
      }).data
      return null
    }

    renderProbe(<LabelsProbe />)
    await flushEffects()

    expect(labels).toEqual(['remote'])
    expect(runtimeMocks.callRuntimeRpc).toHaveBeenCalledExactlyOnceWith(
      { kind: 'environment', environmentId: 'env-explicit' },
      'github.listLabels',
      { repo: 'remote-repo-id' },
      {
        timeoutMs: 15_000,
        expectedEnvironmentPairingRevision: undefined,
        expectedEnvironmentRuntimeId: undefined,
        beforeSend: expect.any(Function)
      }
    )
    const options: unknown = runtimeMocks.callRuntimeRpc.mock.calls[0]?.[3]
    if (
      !options ||
      typeof options !== 'object' ||
      !('beforeSend' in options) ||
      typeof options.beforeSend !== 'function'
    ) {
      throw new Error('metadata request did not supply its currentness callback')
    }
    expect(Object.hasOwn(options, 'expectedEnvironmentPairingRevision')).toBe(true)
    expect(Object.hasOwn(options, 'expectedEnvironmentRuntimeId')).toBe(true)
    const beforeSend = options.beforeSend
    expect(() => beforeSend()).not.toThrow()
    expect(githubMocks.listLabels).not.toHaveBeenCalled()
  })
})
