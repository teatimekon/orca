/** zyx/orca-pure: Linear and Jira are removed; leftover (unmounted) onboarding code reads these inert values. */
export type RemovedTrackerStatus = { connected: boolean; workspaces?: readonly unknown[] }
export const REMOVED_TRACKER_STATUS: RemovedTrackerStatus = { connected: false }
export const REMOVED_TRACKER_CHECKED = true
export const REMOVED_TRACKER_CONTEXT_KEY = ''
export const removedTrackerCheck = async (): Promise<void> => {}
