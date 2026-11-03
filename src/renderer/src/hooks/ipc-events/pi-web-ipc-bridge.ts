import { openPiWebSession } from '@/lib/pi-web/open-pi-web'
import { dispatchPiWebAttention } from '@/lib/pi-web/pi-web-attention-dispatch'
import { acknowledgeViewedPiWebRow } from '@/lib/pi-web/pi-web-attention-surface'
import { forgetPiWebRowsAbsentFrom } from '@/lib/pi-web/pi-web-row-registry'
import { applyPiWebDelta, applyPiWebSnapshot } from '@/lib/pi-web/pi-web-status-apply'
import type { PiWebRow } from '../../../../shared/pi-web/pi-web-status-types'
import { useAppStore } from '../../store'

export function registerPiWebIpcBridge(unsubs: (() => void)[]): void {
  const api = window.api.piWeb
  // Partial window.api stubs (renderer test harnesses) omit this namespace.
  if (!api) {
    return
  }
  let disposed = false
  // Why: subscribing first means no delta slips past the snapshot; removals seen meanwhile stay removed.
  let removedBeforeSnapshot: Set<string> | null = new Set()
  unsubs.push(
    api.onStatusChanged((delta) => {
      for (const row of delta.upserts) {
        removedBeforeSnapshot?.delete(row.sessionId)
      }
      for (const sessionId of delta.removals) {
        removedBeforeSnapshot?.add(sessionId)
      }
      applyPiWebDelta(delta, useAppStore.getState())
      for (const event of delta.events) {
        dispatchPiWebAttention(event)
      }
    })
  )
  unsubs.push(
    api.onOpenSession(({ worktreeId, sessionId }) => {
      openPiWebSession(worktreeId, sessionId).catch((error: unknown) => {
        console.error('[pi-web] failed to open session', error)
      })
    })
  )
  unsubs.push(
    useAppStore.subscribe((state, previous) => {
      if (state.agentStatusByPaneKey !== previous.agentStatusByPaneKey) {
        forgetPiWebRowsAbsentFrom(state.agentStatusByPaneKey)
      }
      // A new turn of the conversation on screen, or arriving at its page, reads it (as a visible pane).
      acknowledgeViewedPiWebRow(state)
    })
  )
  unsubs.push(() => {
    disposed = true
  })
  // Web-client fallbacks and test stubs return non-promises or non-arrays; the executor keeps the call synchronous.
  new Promise<PiWebRow[]>((resolve) => resolve(api.getSnapshot()))
    .then((rows) => {
      const removed = removedBeforeSnapshot ?? new Set<string>()
      removedBeforeSnapshot = null
      if (!disposed && Array.isArray(rows)) {
        applyPiWebSnapshot(rows, useAppStore.getState(), removed)
      }
    })
    .catch((error: unknown) => {
      removedBeforeSnapshot = null
      console.warn('[pi-web] failed to load status snapshot', error)
    })
}
