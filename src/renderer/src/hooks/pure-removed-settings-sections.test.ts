import { describe, expect, it } from 'vitest'
import { buildSettingsNavigationMetadata } from './useSettingsNavigationMetadata'
import { PURE_REMOVED_SETTINGS_SECTION_IDS } from './pure-removed-settings-sections'

describe('pure build removed settings sections', () => {
  it('filters removed sections and keeps the kept ones', () => {
    const ids = buildSettingsNavigationMetadata({
      isMac: true,
      isWindows: false,
      isWebClient: false,
      repos: []
    }).map((s) => s.id)
    for (const removed of PURE_REMOVED_SETTINGS_SECTION_IDS) {
      expect(ids).not.toContain(removed)
    }
    expect(ids).toContain('orca-account')
    expect(ids).toContain('mobile')
    expect(ids).toContain('agents')
  })

  it('indexes no GitHub or GitLab API Budget search entry', () => {
    const titles = buildSettingsNavigationMetadata({
      isMac: true,
      isWindows: false,
      isWebClient: false,
      repos: []
    }).flatMap((section) => section.searchEntries.map((entry) => entry.title))
    expect(titles.filter((title) => /api budget/i.test(title))).toEqual([])
  })
})
