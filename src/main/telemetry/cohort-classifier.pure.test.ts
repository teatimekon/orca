import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  _resetSessionWarnFlagForTests,
  _setStoreForTests,
  getCohortAtEmit
} from './cohort-classifier'

describe('getCohortAtEmit without telemetry init (pure build)', () => {
  afterEach(() => {
    _setStoreForTests(null)
    _resetSessionWarnFlagForTests()
    vi.restoreAllMocks()
  })

  it('returns a stable none and does not warn when no store was registered', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getCohortAtEmit()).toEqual({ nth_repo_added: undefined })
    expect(getCohortAtEmit()).toEqual({ nth_repo_added: undefined })
    expect(warn).not.toHaveBeenCalled()
  })
})
