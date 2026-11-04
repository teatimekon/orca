import { useEffect } from 'react'
import {
  REMOVED_TRACKER_CHECKED,
  REMOVED_TRACKER_CONTEXT_KEY,
  REMOVED_TRACKER_STATUS,
  removedTrackerCheck
} from '../pure-removed-tracker-stubs'
import type { FeatureWallWorkflow } from '../../../../shared/feature-wall-workflows'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { deriveIntegrationConnectionStatus } from './use-integration-connection-status'

export type FeatureWallTaskSourcePresentation = {
  workflow: FeatureWallWorkflow
  hasConnectedTaskSource: boolean
  // Hide disconnected setup until provider checks settle to prevent flashes for connected users.
  isCheckingTaskSources: boolean
}

export function useFeatureWallTaskSourcePresentation(
  isOpen: boolean,
  selected: FeatureWallWorkflow
): FeatureWallTaskSourcePresentation {
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const preflightStatusContextKey = useAppStore((s) => s.preflightStatusContextKey)
  const preflightStatusError = useAppStore((s) => s.preflightStatusError)
  const preflightStatusLoading = useAppStore((s) => s.preflightStatusLoading)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const linearStatus = REMOVED_TRACKER_STATUS
  const linearStatusChecked = REMOVED_TRACKER_CHECKED
  const linearStatusContextKey = REMOVED_TRACKER_CONTEXT_KEY
  const checkLinearConnection = removedTrackerCheck
  const jiraStatus = REMOVED_TRACKER_STATUS
  const jiraStatusChecked = REMOVED_TRACKER_CHECKED
  const jiraStatusContextKey = REMOVED_TRACKER_CONTEXT_KEY
  const checkJiraConnection = removedTrackerCheck
  const settings = useAppStore((s) => s.settings)
  const expectedPreflightContextKey = useAppStore((s) =>
    localPreflightContextKey(getLocalPreflightContext(s))
  )
  const providerRuntimeContextKey = getProviderRuntimeContextKey(settings)
  const linearStatusCurrent = linearStatusContextKey === providerRuntimeContextKey
  const jiraStatusCurrent = jiraStatusContextKey === providerRuntimeContextKey
  const preflightStatusCurrent = preflightStatusContextKey === expectedPreflightContextKey

  useEffect(() => {
    if (!isOpen) {
      return
    }
    // Refresh connection facts before choosing setup-oriented tour copy.
    if (!preflightStatusCurrent || !preflightStatusChecked) {
      void refreshPreflightStatus()
    }
    if (!linearStatusCurrent || !linearStatusChecked) {
      void checkLinearConnection()
    }
    if (!jiraStatusCurrent || !jiraStatusChecked) {
      void checkJiraConnection()
    }
  }, [
    checkJiraConnection,
    checkLinearConnection,
    expectedPreflightContextKey,
    isOpen,
    jiraStatusCurrent,
    jiraStatusChecked,
    jiraStatusContextKey,
    linearStatusCurrent,
    linearStatusChecked,
    linearStatusContextKey,
    preflightStatusContextKey,
    preflightStatusCurrent,
    preflightStatusChecked,
    providerRuntimeContextKey,
    refreshPreflightStatus
  ])

  const taskSourceStatus = deriveIntegrationConnectionStatus({
    preflightStatus,
    preflightStatusChecked,
    preflightStatusContextKey,
    preflightStatusError,
    preflightStatusLoading,
    expectedPreflightContextKey,
    linearStatus,
    linearStatusChecked,
    linearStatusContextKey,
    jiraStatus,
    jiraStatusChecked,
    jiraStatusContextKey,
    providerRuntimeContextKey
  })

  return {
    workflow: selected,
    hasConnectedTaskSource: taskSourceStatus.trackerConnected,
    isCheckingTaskSources: taskSourceStatus.checking
  }
}
