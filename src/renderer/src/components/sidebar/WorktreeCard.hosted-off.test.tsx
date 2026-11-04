import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedReviewInfo } from '../../../../shared/hosted-review'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeCardProperty } from '../../../../shared/ui-chrome-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { WorkspacePortScanResult } from '../../../../shared/workspace-ports'

const fetchHostedReviewForBranch = vi.fn()
const fetchIssue = vi.fn()
const fetchLinearIssue = vi.fn()
const openModal = vi.fn()
const updateWorktreeMeta = vi.fn()

let worktreeCardProperties: WorktreeCardProperty[] = ['status']
let hostedReviewCache: Record<string, unknown> = {}
let issueCache: Record<string, unknown> = {}
let prCache: Record<string, unknown> = {}
let workspacePortScan: WorkspacePortScanResult | null = null
let settings: Partial<GlobalSettings> | null = null

const gate = vi.hoisted(() => ({ HOSTED_SOURCE_CONTROL_ENABLED: true }))
vi.mock('../../../../shared/pure-hosted-source-control', () => gate)

vi.mock('@/store', () => {
  const getState = () => ({
    deleteStateByWorktreeId: {},
    fetchHostedReviewForBranch,
    fetchIssue,
    fetchLinearIssue,
    gitConflictOperationByWorktree: {},
    hostedReviewCache,
    issueCache,
    linearIssueCache: {},
    openModal,
    prCache,
    projectGroups: [],
    remoteBranchConflictByWorktreeId: {},
    settings,
    sshConnectionStates: new Map(),
    sshTargetLabels: new Map(),
    updateWorktreeMeta,
    workspacePortScan,
    worktreeCardProperties
  })
  return {
    useAppStore: Object.assign((selector: (state: unknown) => unknown) => selector(getState()), {
      getState
    })
  }
})

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('./use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => 'active'
}))

vi.mock('./use-worktree-sleep-state', () => ({
  useIsSleepingWorktree: () => false
}))

vi.mock('./CacheTimer', () => ({
  default: () => null,
  usePromptCacheCountdownStartedAt: () => null
}))

vi.mock('./WorktreeCardAgents', () => ({
  default: () => null
}))

vi.mock('./WorktreeContextMenu', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
  WORKTREE_NATIVE_CONTEXT_MENU_ATTR: 'data-worktree-native-context-menu',
  WORKTREE_CONTEXT_MENU_SCOPE_ATTR: 'data-orca-context-menu-scope'
}))

function makeRepo(): Repo {
  return {
    id: 'repo-1',
    path: '/repo',
    displayName: 'orca',
    badgeColor: '#999999',
    addedAt: 1
  }
}

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'repo-1::/repo/worktrees/pr-456',
    repoId: 'repo-1',
    path: '/repo/worktrees/pr-456',
    displayName: 'Fix stale GH PR',
    branch: 'feature/local-branch',
    head: 'abc123',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1,
    ...overrides
  }
}

function makeHostedReview(overrides: Partial<HostedReviewInfo> = {}): HostedReviewInfo {
  return {
    provider: 'github',
    number: 456,
    title: 'Fix stale GH PR',
    state: 'open',
    url: 'https://github.com/acme/orca/pull/456',
    status: 'success',
    updatedAt: '2026-05-17T00:00:00.000Z',
    mergeable: 'MERGEABLE',
    ...overrides
  }
}

function makePRInfo(overrides: Partial<PRInfo> = {}): PRInfo {
  return {
    number: 456,
    title: 'Fix stale GH PR',
    state: 'open',
    url: 'https://github.com/acme/orca/pull/456',
    checksStatus: 'success',
    updatedAt: '2026-05-17T00:00:00.000Z',
    mergeable: 'MERGEABLE',
    ...overrides
  }
}

function renderWorktreeCardMarkup(element: ReactNode): string {
  return renderToStaticMarkup(<>{element}</>)
}

describe('WorktreeCard without hosted source control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gate.HOSTED_SOURCE_CONTROL_ENABLED = false
    hostedReviewCache = {}
    issueCache = {}
    prCache = {}
    workspacePortScan = null
    settings = null
  })

  it('renders no PR, checks or GitHub issue decoration when hosted source control is off', async () => {
    gate.HOSTED_SOURCE_CONTROL_ENABLED = false
    worktreeCardProperties = ['status', 'pr', 'issue']
    hostedReviewCache = {
      'local::repo-1::feature/local-branch': {
        data: makeHostedReview({ status: 'failure' }),
        fetchedAt: Date.now()
      }
    }
    prCache = {
      'repo-1::feature/local-branch': {
        data: makePRInfo({ number: 456, checksStatus: 'failure' }),
        fetchedAt: Date.now()
      }
    }
    issueCache = {
      'local::repo-1::12': {
        data: {
          number: 12,
          title: 'Some issue',
          state: 'open',
          url: 'https://github.com/acme/orca/issues/12'
        },
        fetchedAt: Date.now()
      }
    }
    const { default: WorktreeCard } = await import('./WorktreeCard')

    for (const nextSettings of [{ experimentalNewWorktreeCardStyle: true }, null]) {
      settings = nextSettings
      const markup = renderWorktreeCardMarkup(
        <WorktreeCard
          worktree={makeWorktree({ linkedPR: 456, linkedIssue: 12 })}
          repo={makeRepo()}
          isActive={false}
        />
      )
      for (const decoration of ['PR checks', 'PR: ', '#456', 'Linked PR', '#12']) {
        expect(
          markup,
          markup.slice(
            Math.max(0, markup.indexOf(decoration) - 200),
            markup.indexOf(decoration) + 100
          )
        ).not.toContain(decoration)
      }
    }
  })

  it('hides live port metadata when the Ports card property is disabled', async () => {
    const worktree = makeWorktree()
    workspacePortScan = {
      platform: 'darwin',
      scannedAt: 1,
      ports: [
        {
          id: '127.0.0.1:58941:1234',
          bindHost: '127.0.0.1',
          connectHost: '127.0.0.1',
          port: 58941,
          pid: 1234,
          processName: 'node',
          protocol: 'http',
          kind: 'workspace',
          owner: {
            worktreeId: worktree.id,
            repoId: worktree.repoId,
            displayName: worktree.displayName,
            path: worktree.path,
            confidence: 'cwd'
          }
        }
      ]
    }
    worktreeCardProperties = []
    const { default: WorktreeCard } = await import('./WorktreeCard')

    const markup = renderWorktreeCardMarkup(
      <WorktreeCard worktree={worktree} repo={makeRepo()} isActive={false} />
    )

    expect(markup).not.toContain('live port')
    expect(markup).not.toContain('Live Ports')
    expect(markup).not.toContain('58941')
  })
})
