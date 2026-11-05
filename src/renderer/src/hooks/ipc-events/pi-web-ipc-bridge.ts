import { openPiWebSession } from '@/lib/pi-web/open-pi-web'
import { dispatchPiWebAttention } from '@/lib/pi-web/pi-web-attention-dispatch'
import { acknowledgeViewedPiWebRow } from '@/lib/pi-web/pi-web-attention-surface'
import { forgetPiWebRowsAbsentFrom } from '@/lib/pi-web/pi-web-row-registry'
import { applyPiWebDelta, applyPiWebSnapshot } from '@/lib/pi-web/pi-web-status-apply'
import {
  createPiWebTabBindingWatcher,
  type PiWebTabBindingWatcher
} from '@/lib/pi-web/pi-web-tab-bindings'
import type { PiWebRow } from '../../../../shared/pi-web/pi-web-status-types'
import type { PiWebApi } from '../../../../preload/api/pi-web-api'
import { useAppStore } from '../../store'

/** Tells main which workspace's tab shows each pi-web conversation; only those get rows. */
function startPiWebTabBindings(
  api: PiWebApi,
  unsubs: (() => void)[]
): PiWebTabBindingWatcher | null {
  // Partial window.api stubs (renderer test harnesses) predate tab bindings.
  if (
    typeof api.bind !== 'function' ||
    typeof api.getServerUrl !== 'function' ||
    typeof api.onServerUrlChanged !== 'function'
  ) {
    return null
  }
  const watcher = createPiWebTabBindingWatcher((request) => {
    api.bind(request).catch((error: unknown) => {
      console.warn('[pi-web] failed to bind session', error)
    })
  })
  let pushed = false
  unsubs.push(
    api.onServerUrlChanged((url) => {
      pushed = true
      watcher.setServerUrl(url, useAppStore.getState())
    })
  )
  // Web-client fallbacks and test stubs may answer synchronously; the executor normalizes that.
  new Promise<string | null>((resolve) => resolve(api.getServerUrl()))
    .then((url) => {
      // A push already carried a URL at least as new as this answer.
      if (url && !pushed) {
        watcher.setServerUrl(url, useAppStore.getState())
      }
    })
    .catch((error: unknown) => {
      console.warn('[pi-web] failed to read the server url', error)
    })
  return watcher
}

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
  const tabBindings = startPiWebTabBindings(api, unsubs)
  unsubs.push(
    useAppStore.subscribe((state, previous) => {
      tabBindings?.sync(state)
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
