import { describe, expect, it } from 'vitest'
import { getExperimentalPaneSearchEntries } from './experimental-search'

describe('Experimental settings search in the pure build', () => {
  it('does not index removed Pet, Agent Dashboard, Cloud VM or Browser extensions toggles', () => {
    const titles = getExperimentalPaneSearchEntries().map((entry) => entry.title)
    for (const removed of ['Pet', 'Agent Dashboard', 'Cloud VM', 'Browser extensions']) {
      expect(titles).not.toContain(removed)
    }
    expect(titles).toContain('Terminal attention')
  })
})
