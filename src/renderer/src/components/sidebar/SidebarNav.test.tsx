// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { Repo } from '../../../../shared/repo-types'
import { i18n } from '../../i18n/i18n'
import { PSEUDO_LOCALIZATION_LOCALE } from '../../i18n/pseudo-localization'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  openTaskPage: vi.fn(),
  openAutomationsPage: vi.fn(),
  openActivityPage: vi.fn(),
  openMobilePage: vi.fn(),
  openArtifactsPage: vi.fn(),
  openModal: vi.fn(),
  updateSettings: vi.fn(),
  refreshPreflightStatus: vi.fn(),
  checkLinearConnection: vi.fn(),
  hasPairedMobileDevice: false,
  agentBucketCounts: { attention: 0, working: 0, done: 0, idle: 0 },
  getAgentBucketCounts: vi.fn(),
  dismissMobileOnboardingBadge: vi.fn(),
  setSetupGuideSidebarDismissed: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))

vi.mock('@/store/selectors', () => ({
  useRepoMap: () =>
    new Map(
      ((mocks.state.repos as Repo[] | undefined) ?? []).map((repo) => [repo.id, repo] as const)
    )
}))

vi.mock('@/components/activity/useActivityUnreadCount', () => ({
  useActivityUnreadCount: () => 0
}))

vi.mock('@/components/dashboard/useAgentBucketCounts', () => ({
  useAgentBucketCounts: () => {
    mocks.getAgentBucketCounts()
    return mocks.agentBucketCounts
  }
}))

vi.mock('@/hooks/useShortcutLabel', () => ({
  useShortcutKeyComboDetails: () => [{ keys: ['⌘', 'J'], doubleTap: false }]
}))

vi.mock('./mobile-sidebar-onboarding-badge', () => ({
  useMobileSidebarOnboardingBadge: () => ({
    visible: false,
    hasPairedDevice: mocks.hasPairedMobileDevice,
    dismiss: mocks.dismissMobileOnboardingBadge
  })
}))

vi.mock('../setup-guide/use-setup-guide-progress', () => ({
  useSetupGuideProgress: () => ({
    ready: true,
    coreDoneCount: 0,
    coreTotal: 1,
    stepDone: {}
  })
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => (
    <div data-testid="context-menu">{children}</div>
  ),
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="context-menu-content">{children}</div>
  ),
  ContextMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  )
}))

import SidebarNav, {
  shouldShowAutomationsButton,
  shouldShowArtifactsButton,
  shouldShowMobileButton
} from './SidebarNav'

function gitRepo(): Repo {
  return {
    id: 'repo-1',
    path: '/tmp/repo-1',
    displayName: 'repo-1',
    badgeColor: 'gray',
    addedAt: 1,
    kind: 'git'
  }
}

function setSidebarState({
  settings = getDefaultSettings('/tmp'),
  repos = [gitRepo()]
}: {
  settings?: GlobalSettings
  repos?: Repo[]
} = {}): void {
  mocks.state = {
    settings,
    repos,
    activeView: 'worktrees',
    openTaskPage: mocks.openTaskPage,
    openAutomationsPage: mocks.openAutomationsPage,
    openActivityPage: mocks.openActivityPage,
    openMobilePage: mocks.openMobilePage,
    openArtifactsPage: mocks.openArtifactsPage,
    openModal: mocks.openModal,
    updateSettings: mocks.updateSettings,
    preflightStatus: { glab: { installed: false } },
    preflightStatusChecked: true,
    refreshPreflightStatus: mocks.refreshPreflightStatus,
    linearStatus: { connected: false },
    linearStatusChecked: true,
    checkLinearConnection: mocks.checkLinearConnection,
    prefetchWorkItems: vi.fn(),
    activeRepoId: null,
    persistedUIReady: true,
    activeModal: null,
    setupGuideSidebarDismissed: true,
    setSetupGuideSidebarDismissed: mocks.setSetupGuideSidebarDismissed
  }
}

const mountedRoots: Root[] = []

async function renderSidebarNav(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => {
    root.render(
      <TooltipProvider>
        <SidebarNav />
      </TooltipProvider>
    )
  })
  return container
}

function queryButtonByText(container: ParentNode, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  )
}

function getButtonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = queryButtonByText(container, text)
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
}

function getHideButton(menu: Element): HTMLButtonElement {
  const button =
    Array.from(menu.querySelectorAll<HTMLButtonElement>('button')).find((candidate) =>
      candidate.textContent?.includes('Hide from sidebar')
    ) ?? null
  if (!button) {
    throw new Error('Hide from sidebar button not found')
  }
  return button
}

async function clickButton(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

vi.mock('../../../../shared/pure-hosted-source-control', () => ({
  HOSTED_SOURCE_CONTROL_ENABLED: true
}))

describe('SidebarNav', () => {
  afterEach(async () => {
    await act(async () => {
      for (const root of mountedRoots.splice(0)) {
        root.unmount()
      }
    })
    document.body.innerHTML = ''
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
    mocks.hasPairedMobileDevice = false
    mocks.agentBucketCounts = { attention: 0, working: 0, done: 0, idle: 0 }
    setSidebarState()
  })

  it('never mounts the Agent Dashboard row, even with the experiment enabled', async () => {
    setSidebarState({
      settings: {
        ...getDefaultSettings('/tmp'),
        experimentalAgentDashboardPopout: true
      }
    })
    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Agent Dashboard')).toBeNull()
    expect(mocks.getAgentBucketCounts).not.toHaveBeenCalled()
  })

  it('shows the Mobile entry by default for older settings', () => {
    expect(shouldShowMobileButton(null)).toBe(true)
    expect(shouldShowMobileButton({})).toBe(true)
  })

  it('hides the Artifacts entry by default for older settings', () => {
    expect(shouldShowArtifactsButton(null)).toBe(false)
    expect(shouldShowArtifactsButton({})).toBe(false)
    expect(shouldShowArtifactsButton({ showArtifactsButton: true })).toBe(true)
    expect(shouldShowArtifactsButton({ showArtifactsButton: false })).toBe(false)
  })

  it('never renders Artifacts, even with showArtifactsButton', async () => {
    setSidebarState({
      settings: { ...getDefaultSettings('/tmp'), showArtifactsButton: true }
    })
    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Artifacts')).toBeNull()
  })

  it('hides the Mobile entry when the sidebar setting is off', () => {
    expect(shouldShowMobileButton({ showMobileButton: false })).toBe(false)
  })

  it('updates localized labels when the language changes after mount', async () => {
    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Orca Mobile')).not.toBeNull()

    await act(async () => {
      await i18n.changeLanguage('zh')
    })

    expect(queryButtonByText(container, 'Orca 手机端')).not.toBeNull()
  })

  it('updates labels when pseudo-localization is enabled after mount', async () => {
    const container = await renderSidebarNav()

    await act(async () => {
      await i18n.changeLanguage(PSEUDO_LOCALIZATION_LOCALE)
    })

    expect(queryButtonByText(container, '[Orca Mobile]')).not.toBeNull()
  })

  it('shows the inline hide control only once a device is paired', async () => {
    const beforePairing = await renderSidebarNav()
    expect(queryButtonByText(beforePairing, 'Orca Mobile')).not.toBeNull()
    expect(beforePairing.querySelector('button[aria-label="Hide from sidebar"]')).toBeNull()

    mocks.hasPairedMobileDevice = true
    const container = await renderSidebarNav()
    const hideButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Hide from sidebar"]'
    )

    expect(queryButtonByText(container, 'Orca Mobile')).not.toBeNull()
    expect(hideButton).not.toBeNull()
    expect(hideButton?.querySelector('svg')).not.toBeNull()

    await clickButton(hideButton as HTMLButtonElement)

    expect(mocks.updateSettings).toHaveBeenCalledWith({ showMobileButton: false })
    expect(mocks.openMobilePage).not.toHaveBeenCalled()
  })

  it('shows the Automations entry by default for older settings', () => {
    expect(shouldShowAutomationsButton(null)).toBe(true)
    expect(shouldShowAutomationsButton({})).toBe(true)
  })

  it('renders no Tasks entry, even with showTasksButton', async () => {
    setSidebarState({
      settings: {
        ...getDefaultSettings('/tmp'),
        showTasksButton: true
      }
    })

    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Tasks')).toBeNull()
  })

  it('renders no Automations entry, even with showAutomationsButton', async () => {
    setSidebarState({
      settings: {
        ...getDefaultSettings('/tmp'),
        showAutomationsButton: true
      }
    })

    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Automations')).toBeNull()
  })

  it('hides Mobile from its sidebar context menu', async () => {
    const container = await renderSidebarNav()

    const mobileMenu = getButtonByText(container, 'Orca Mobile').closest(
      '[data-testid="context-menu"]'
    )
    expect(mobileMenu).not.toBeNull()

    await clickButton(getHideButton(mobileMenu as HTMLElement))

    expect(mocks.updateSettings).toHaveBeenCalledWith({ showMobileButton: false })
  })

  it('places the worktree palette search above the sidebar nav rows', async () => {
    const container = await renderSidebarNav()
    const nav = container.querySelector('[data-contextual-tour-target="sidebar-navigation"]')
    const searchButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Search worktrees and browser tabs"]'
    )
    const mobileButton = getButtonByText(container, 'Orca Mobile')

    expect(nav?.firstElementChild).toBe(searchButton)
    if (!searchButton) {
      throw new Error('worktree palette search button not rendered')
    }
    expect(
      searchButton.compareDocumentPosition(mobileButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('hides the worktree palette shortcut until the search field is hovered or focused', async () => {
    const container = await renderSidebarNav()

    const searchButton = container.querySelector(
      'button[aria-label="Search worktrees and browser tabs"]'
    )
    expect(searchButton).not.toBeNull()
    expect(searchButton?.className).toContain('bg-worktree-sidebar-foreground/5')

    const shortcuts = searchButton?.querySelector('span.hidden')
    expect(shortcuts?.className).toContain('hidden')
    expect(shortcuts?.className).toContain('group-hover:flex')
    expect(shortcuts?.className).toContain('group-focus-within:flex')
    expect(shortcuts?.textContent).toContain('⌘')
    expect(shortcuts?.textContent).toContain('J')
    expect(searchButton?.querySelector('kbd')).toBeNull()
  })
})
