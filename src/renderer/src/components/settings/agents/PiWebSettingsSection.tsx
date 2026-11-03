import { useEffect, useState } from 'react'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import {
  DEFAULT_PI_WEB_SETTINGS,
  type PiWebSettings
} from '../../../../../shared/pi-web/pi-web-status-types'
import { Input } from '../../ui/input'
import { SettingsRow, SettingsSubsectionHeader, SettingsSwitchRow } from '../form-controls/SettingsFormControls'
import { translate } from '@/i18n/i18n'

type PiWebSettingsSectionProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

type TextField = 'serverUrl' | 'agentDir' | 'launchCwd' | 'launchCommand'

function resolvePiWebSettings(settings: GlobalSettings): PiWebSettings {
  // Why: persisted settings may hold a partial piWeb object, so fall back per field.
  const stored: Partial<PiWebSettings> = settings.piWeb ?? {}
  return {
    enabled: stored.enabled ?? DEFAULT_PI_WEB_SETTINGS.enabled,
    serverUrl:
      stored.serverUrl === undefined ? DEFAULT_PI_WEB_SETTINGS.serverUrl : stored.serverUrl,
    agentDir: stored.agentDir ?? DEFAULT_PI_WEB_SETTINGS.agentDir,
    launchCwd: stored.launchCwd ?? DEFAULT_PI_WEB_SETTINGS.launchCwd,
    launchCommand: stored.launchCommand ?? DEFAULT_PI_WEB_SETTINGS.launchCommand
  }
}

function PiWebTextRow({
  id,
  label,
  description,
  value,
  placeholder,
  onCommit
}: {
  id: string
  label: string
  description?: string
  value: string
  placeholder?: string
  onCommit: (value: string) => void
}): React.JSX.Element {
  // Why: commit on blur/Enter only; every write can make the main process reconnect the bridge.
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = (): void => {
    if (draft !== value) {
      onCommit(draft)
    }
  }
  return (
    <SettingsRow
      label={label}
      description={description}
      control={
        <Input
          id={id}
          aria-label={label}
          className="w-80"
          value={draft}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit()
            }
          }}
        />
      }
    />
  )
}

export function PiWebSettingsSection({
  settings,
  updateSettings
}: PiWebSettingsSectionProps): React.JSX.Element {
  const piWeb = resolvePiWebSettings(settings)
  const write = (patch: Partial<PiWebSettings>): void => {
    void updateSettings({ piWeb: { ...piWeb, ...patch } })
  }
  const commitText = (field: TextField, raw: string): void => {
    if (field === 'serverUrl') {
      const trimmed = raw.trim()
      write({ serverUrl: trimmed === '' ? null : trimmed })
      return
    }
    if (field === 'agentDir') {
      write({ agentDir: raw })
    } else if (field === 'launchCwd') {
      write({ launchCwd: raw })
    } else {
      write({ launchCommand: raw })
    }
  }

  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader title={translate('piWeb.settings.title', 'pi-web')} />
      <SettingsSwitchRow
        label={translate('piWeb.settings.track', 'Track pi-web conversations')}
        checked={piWeb.enabled}
        onChange={() => write({ enabled: !piWeb.enabled })}
        ariaLabel={translate('piWeb.settings.track', 'Track pi-web conversations')}
      />
      <PiWebTextRow
        id="settings-pi-web-server-url"
        label={translate('piWeb.settings.serverUrl', 'Server URL')}
        description={translate(
          'piWeb.settings.serverUrlDescription',
          'Leave empty to auto-discover a running pi-web server.'
        )}
        value={piWeb.serverUrl ?? ''}
        placeholder={translate('piWeb.settings.autoDiscover', 'Auto-discover')}
        onCommit={(v) => commitText('serverUrl', v)}
      />
      <PiWebTextRow
        id="settings-pi-web-agent-dir"
        label={translate('piWeb.settings.agentDir', 'Agent directory')}
        value={piWeb.agentDir}
        onCommit={(v) => commitText('agentDir', v)}
      />
      <PiWebTextRow
        id="settings-pi-web-launch-cwd"
        label={translate('piWeb.settings.launchCwd', 'Launch directory')}
        value={piWeb.launchCwd}
        onCommit={(v) => commitText('launchCwd', v)}
      />
      <PiWebTextRow
        id="settings-pi-web-launch-command"
        label={translate('piWeb.settings.launchCommand', 'Launch command')}
        value={piWeb.launchCommand}
        onCommit={(v) => commitText('launchCommand', v)}
      />
      <p className="select-text text-xs text-muted-foreground">
        {translate(
          'piWeb.settings.envOverride',
          'Environment variables ORCA_PI_WEB_* override these (used by dev builds).'
        )}
      </p>
    </section>
  )
}
