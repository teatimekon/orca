import { describe, expect, it } from 'vitest'
import { resolveRightSidebarEffectiveTab } from './right-sidebar-effective-tab'

describe('resolveRightSidebarEffectiveTab in the pure build', () => {
  it('falls back to the first visible tab when the persisted tab is the removed vault', () => {
    expect(
      resolveRightSidebarEffectiveTab({
        normalizedActiveTab: 'vault',
        visibleItems: [{ id: 'explorer' }, { id: 'source-control' }],
        activeFolderWorkspaceKey: null,
        rememberedFolderTab: null
      })
    ).toBe('explorer')
  })
})
