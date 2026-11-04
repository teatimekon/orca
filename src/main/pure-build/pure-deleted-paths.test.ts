import { describe, expect, it } from 'vitest'
import { PURE_DELETED_PATHS, pureDeletedPathMatcher } from './pure-deleted-paths'

describe('pureDeletedPathMatcher', () => {
  const matches = pureDeletedPathMatcher(['src/a/**', 'src/b/x-*', '!src/a/keep.ts'])

  it('accepts anything below ** and a single-segment *', () => {
    expect(matches('src/a/b/c.ts')).toBe(true)
    expect(matches('src/b/x-y.ts')).toBe(true)
  })

  it('rejects look-alikes, nested * matches and kept paths', () => {
    expect(matches('src/ab.ts')).toBe(false)
    expect(matches('src/b/x-y/z.ts')).toBe(false)
    expect(matches('src/a/keep.ts')).toBe(false)
  })
})

describe('PURE_DELETED_PATHS', () => {
  it('has no duplicates', () => {
    expect(new Set(PURE_DELETED_PATHS).size).toBe(PURE_DELETED_PATHS.length)
  })

  it('every ! entry follows a positive pattern that matches it', () => {
    PURE_DELETED_PATHS.forEach((pattern, index) => {
      if (!pattern.startsWith('!')) {
        return
      }
      const before = PURE_DELETED_PATHS.slice(0, index)
      expect(pureDeletedPathMatcher(before)(pattern.slice(1)), pattern).toBe(true)
    })
  })
})
