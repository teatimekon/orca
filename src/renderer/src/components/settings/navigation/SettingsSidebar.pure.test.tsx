// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsSidebar } from './SettingsSidebar'

vi.mock('../setup-guide/settings-setup-guide-progress', () => ({
  useSettingsSetupGuideProgress: () => ({ ready: true, doneCount: 0, total: 5 })
}))

afterEach(cleanup)

describe('SettingsSidebar in the pure build', () => {
  it('never renders the Setup Guide row, even when setup is incomplete', () => {
    render(
      <TooltipProvider>
        <SettingsSidebar
          activeSectionId="general"
          settings={null}
          generalGroups={[]}
          repoSections={[]}
          hasRepos={false}
          onBack={() => {}}
          onSelectSection={() => {}}
        />
      </TooltipProvider>
    )
    expect(screen.queryByText('Onboarding checklist')).toBeNull()
  })
})
