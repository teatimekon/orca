import { useEffect, useState } from 'react'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import {
  DEFAULT_PI_WEB_SETTINGS,
  type PiWebSettings
} from '../../../../../shared/pi-web/pi-web-status-types'
import { Input } from '../../ui/input'
import { SettingsRow, SettingsSubsectionHeader, SettingsSwitchRow } from '../form-controls/SettingsFormControls'
import { translate } from '@/i18n/i18n'
import { usePiWebEffectiveConfig } from '@/lib/pi-web/pi-web-effective-config'

type PiWebSettingsSectionProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

type TextField = 'serverUrl' | 'agentDir' | 'launchCwd' | 'launchCommand'

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function resolvePiWebSettings(settings: GlobalSettings): PiWebSettings {
  // Why: persisted settings may hold a partial or corrupt piWeb object, so check each field.
  const stored: Partial<Record<keyof PiWebSettings, unknown>> = settings.piWeb ?? {}
  const defaults = DEFAULT_PI_WEB_SETTINGS
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : defaults.enabled,
    serverUrl: typeof stored.serverUrl === 'string' ? stored.serverUrl : defaults.serverUrl,
    agentDir: textOr(stored.agentDir, defaults.agentDir),
    launchCwd: textOr(stored.launchCwd, defaults.launchCwd),
    launchCommand: textOr(stored.launchCommand, defaults.launchCommand)
  }
}

function overrideNote(variable: string): string {
  return translate('piWeb.settings.overriddenBy', 'Overridden by {{variable}} in this session', {
    variable
  })
}

/** A field an ORCA_PI_WEB_* variable sets: the value in effect and that variable. */
type EnvOverride = { variable: string; value: string }

function PiWebTextRow({
  id,
  label,
  description,
  value,
  placeholder,
  onCommit,
  override
}: {
  id: string
  label: string
  description?: string
  value: string
  placeholder?: string
  onCommit: (value: string) => void
  override?: EnvOverride
}): React.JSX.Element {
  // Why: commit on blur/Enter only; every write can make the main process reconnect the bridge.
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  if (override) {
    // Why read-only: a stored edit would not take effect while the variable is set.
    return (
      <SettingsRow
        label={label}
        description={overrideNote(override.variable)}
        control={
          <Input
            id={id}
            aria-label={label}
            className="w-80"
            value={override.value}
            readOnly
            disabled
            spellCheck={false}
          />
        }
      />
    )
  }
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
  const effective = usePiWebEffectiveConfig(settings.piWeb)
  const overrideOf = (field: TextField): EnvOverride | undefined => {
    const variable = effective?.envOverrides[field]
    return variable ? { variable, value: effective.config[field] ?? '' } : undefined
  }
  const enabledVariable = effective?.envOverrides.enabled
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
        description={enabledVariable ? overrideNote(enabledVariable) : undefined}
        checked={enabledVariable && effective ? effective.config.enabled : piWeb.enabled}
        disabled={enabledVariable !== undefined}
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
        override={overrideOf('serverUrl')}
      />
      <PiWebTextRow
        id="settings-pi-web-agent-dir"
        label={translate('piWeb.settings.agentDir', 'Agent directory')}
        value={piWeb.agentDir}
        onCommit={(v) => commitText('agentDir', v)}
        override={overrideOf('agentDir')}
      />
      <PiWebTextRow
        id="settings-pi-web-launch-cwd"
        label={translate('piWeb.settings.launchCwd', 'Launch directory')}
        value={piWeb.launchCwd}
        onCommit={(v) => commitText('launchCwd', v)}
        override={overrideOf('launchCwd')}
      />
      <PiWebTextRow
        id="settings-pi-web-launch-command"
        label={translate('piWeb.settings.launchCommand', 'Launch command')}
        value={piWeb.launchCommand}
        onCommit={(v) => commitText('launchCommand', v)}
        override={overrideOf('launchCommand')}
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
