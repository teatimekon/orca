// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTEXTUAL_TOUR_IDS } from '../../../shared/contextual-tours'
import { getDefaultOnboardingState } from '../../../shared/onboarding-defaults'
import { useAppStore } from '../store'
import { usePureEducationGate } from './pure-education-gate'

afterEach(cleanup)

describe('usePureEducationGate', () => {
  it('never renders onboarding and ignores startup onboarding state', () => {
    const { result } = renderHook(() => usePureEducationGate())
    expect(result.current.shouldRender).toBe(false)
    expect(result.current.onboarding).toBeNull()
    expect(result.current.chatUiHereCornerCardOpen).toBe(false)
    act(() =>
      result.current.applyStartupOnboardingState({
        ...getDefaultOnboardingState(),
        closedAt: null
      })
    )
    expect(result.current.shouldRender).toBe(false)
    expect(result.current.onboarding).toBeNull()
  })

  it('is stable across renders', () => {
    const { result, rerender } = renderHook(() => usePureEducationGate())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('blocks every contextual tour, even forced ones', () => {
    renderHook(() => usePureEducationGate())
    expect(useAppStore.getState().contextualToursOnboardingVisible).toBe(true)
    act(() => {
      useAppStore.setState({ persistedUIReady: true })
      useAppStore
        .getState()
        .requestContextualTour(CONTEXTUAL_TOUR_IDS[0], 'test', false, { force: true })
    })
    expect(useAppStore.getState().activeContextualTourId).toBeNull()
  })
})
