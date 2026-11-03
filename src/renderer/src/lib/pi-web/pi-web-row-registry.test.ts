import { describe, expect, it } from 'vitest'
import { piWebPaneKey } from '../../../../shared/pi-web/pi-web-pane-key'
import type { PiWebRow } from '../../../../shared/pi-web/pi-web-status-types'
import { forgetPiWebRow, lookupPiWebRow, rememberPiWebRow } from './pi-web-row-registry'

function makeRow(sessionId: string, worktreeId: string): PiWebRow {
  return {
    sessionId,
    worktreeId,
    cwd: '/repo/wt-1',
    name: null,
    state: 'working',
    stateStartedAt: 1000,
    updatedAt: 1000
  }
}

describe('pi-web row registry', () => {
  it('maps a remembered row pane key back to its session until forgotten', () => {
    const paneKey = rememberPiWebRow(makeRow('session-registry', 'wt-1'))

    expect(paneKey).toBe(piWebPaneKey('session-registry'))
    expect(lookupPiWebRow(paneKey)).toEqual({ sessionId: 'session-registry', worktreeId: 'wt-1' })

    rememberPiWebRow(makeRow('session-registry', 'wt-2'))
    expect(lookupPiWebRow(paneKey)).toEqual({ sessionId: 'session-registry', worktreeId: 'wt-2' })

    expect(forgetPiWebRow('session-registry')).toBe(paneKey)
    expect(lookupPiWebRow(paneKey)).toBeNull()
    expect(forgetPiWebRow('session-registry')).toBeNull()
  })
})
