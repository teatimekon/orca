import { describe, expect, it } from 'vitest'
import {
  sanitizeHydratedActiveView,
  sanitizeHydratedGroupBy
} from './ui-slice-hydration-sanitizers'

describe('sanitizeHydratedActiveView in the pure build', () => {
  it('falls back to terminal for removed views', () => {
    expect(sanitizeHydratedActiveView('activity')).toBe('terminal')
    expect(sanitizeHydratedActiveView('artifacts')).toBe('terminal')
  })

  it('keeps other views unchanged', () => {
    expect(sanitizeHydratedActiveView('settings')).toBe('settings')
    expect(sanitizeHydratedActiveView('terminal')).toBe('terminal')
  })

  it('retires the parent and PR groupings', () => {
    expect(sanitizeHydratedGroupBy('pr-status')).toBe('none')
    expect(sanitizeHydratedGroupBy('parent')).toBe('repo')
    expect(sanitizeHydratedGroupBy('repo')).toBe('repo')
    expect(sanitizeHydratedGroupBy('workspace-status')).toBe('workspace-status')
  })
})
