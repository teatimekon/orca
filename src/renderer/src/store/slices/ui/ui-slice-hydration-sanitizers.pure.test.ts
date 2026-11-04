import { describe, expect, it } from 'vitest'
import { sanitizeHydratedActiveView } from './ui-slice-hydration-sanitizers'

describe('sanitizeHydratedActiveView in the pure build', () => {
  it('falls back to terminal for removed views', () => {
    expect(sanitizeHydratedActiveView('activity')).toBe('terminal')
    expect(sanitizeHydratedActiveView('artifacts')).toBe('terminal')
  })

  it('keeps other views unchanged', () => {
    expect(sanitizeHydratedActiveView('settings')).toBe('settings')
    expect(sanitizeHydratedActiveView('terminal')).toBe('terminal')
  })
})
