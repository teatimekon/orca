import { vi } from 'vitest'

// Why: updater tests exercise packaged-build behavior; the production constant disables it.
vi.mock('../../src/shared/self-built-build', () => ({ SELF_BUILT_BUILD: false }))
