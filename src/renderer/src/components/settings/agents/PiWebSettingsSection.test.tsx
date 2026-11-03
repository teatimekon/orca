// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../../shared/constants'
import {
  DEFAULT_PI_WEB_SETTINGS,
  type PiWebEffectiveConfig
} from '../../../../../shared/pi-web/pi-web-status-types'
import { PiWebSettingsSection } from './PiWebSettingsSection'

const EFFECTIVE: PiWebEffectiveConfig = {
  config: {
    enabled: true,
    serverUrl: null,
    agentDir: '/Users/a1/.pi-orca-dev/agent',
    launchCwd: '/Users/a1/Documents/code/pi-web-worktrees/orca-status',
    launchCommand: 'PI_OFFLINE=1 node bin/pi-web.js --no-open --port 30142 --hostname 0.0.0.0'
  },
  envOverrides: {
    agentDir: 'ORCA_PI_WEB_AGENT_DIR',
    launchCwd: 'ORCA_PI_WEB_LAUNCH_CWD',
    launchCommand: 'ORCA_PI_WEB_LAUNCH_COMMAND'
  }
}

function renderSection(effective: PiWebEffectiveConfig) {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: { piWeb: { getEffectiveConfig: vi.fn(async () => effective) } }
    })
  )
  const updateSettings = vi.fn()
  render(
    <PiWebSettingsSection
      settings={{ ...getDefaultSettings('/tmp'), piWeb: { ...DEFAULT_PI_WEB_SETTINGS } }}
      updateSettings={updateSettings}
    />
  )
  return updateSettings
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PiWebSettingsSection', () => {
  it('shows each env-overridden field read-only with the value in effect, and names its variable', async () => {
    renderSection(EFFECTIVE)

    await waitFor(() => expect(input('Launch command').value).toContain('--port 30142'))
    expect(input('Launch command').readOnly).toBe(true)
    expect(input('Agent directory').value).toBe('/Users/a1/.pi-orca-dev/agent')
    expect(input('Agent directory').readOnly).toBe(true)
    expect(input('Launch directory').readOnly).toBe(true)
    expect(screen.getByText('Overridden by ORCA_PI_WEB_AGENT_DIR in this session')).toBeTruthy()
    expect(screen.getByText('Overridden by ORCA_PI_WEB_LAUNCH_CWD in this session')).toBeTruthy()
    expect(
      screen.getByText('Overridden by ORCA_PI_WEB_LAUNCH_COMMAND in this session')
    ).toBeTruthy()
    // A field no variable sets stays the stored, editable value.
    expect(input('Server URL').readOnly).toBe(false)
    expect(screen.queryByText(/ORCA_PI_WEB_URL/)).toBeNull()
  })

  it('an env-forced switch shows its state and cannot be flipped', async () => {
    renderSection({
      config: { ...EFFECTIVE.config, enabled: false },
      envOverrides: { enabled: 'ORCA_PI_WEB_ENABLED' }
    })

    await waitFor(() =>
      expect(screen.getByText('Overridden by ORCA_PI_WEB_ENABLED in this session')).toBeTruthy()
    )
    const toggle = screen.getByRole('switch', { name: 'Track pi-web conversations' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect((toggle as HTMLButtonElement).disabled).toBe(true)
    expect(input('Agent directory').readOnly).toBe(false)
  })
})
