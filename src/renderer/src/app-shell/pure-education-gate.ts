import { useEffect, useMemo } from 'react'
import { useAppStore } from '../store'
import type { OnboardingGate } from './use-onboarding-and-feature-tips'

const noop = (): void => {}

/** zyx/orca-pure: replaces useOnboardingAndFeatureTips. Onboarding, feature tips and tours never render. */
export function usePureEducationGate(): OnboardingGate {
  useEffect(() => {
    // Why: the onboarding flag blocks every tour, including forced ones (contextual-tour-gate.ts).
    useAppStore.getState().setContextualToursOnboardingVisible(true)
  }, [])
  return useMemo(
    () => ({
      applyStartupOnboardingState: noop,
      onboarding: null,
      setOnboarding: noop,
      shouldRender: false,
      chatUiHereCornerCardOpen: false,
      setChatUiHereCornerCardOpen: noop
    }),
    []
  )
}
