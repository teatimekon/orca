// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CloudVmSetupGuide } from './CloudVmSetupGuide'

afterEach(cleanup)

describe('CloudVmSetupGuide in the pure build', () => {
  it('does not offer a link to the removed recipes section', () => {
    render(<CloudVmSetupGuide />)
    expect(screen.queryByRole('button', { name: /Set up recipes/ })).toBeNull()
  })
})
