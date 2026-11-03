import { useEffect, useState } from 'react'
import {
  DEFAULT_PI_WEB_SETTINGS,
  type PiWebEffectiveConfig,
  type PiWebSettings
} from '../../../../shared/pi-web/pi-web-status-types'

/** The config main's bridge uses, asked again whenever `stored` changes; null until main answers. */
export function usePiWebEffectiveConfig(
  stored: Partial<PiWebSettings> | undefined
): PiWebEffectiveConfig | null {
  const [effective, setEffective] = useState<PiWebEffectiveConfig | null>(null)
  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api?.piWeb
    // Partial window.api stubs (web client, test harnesses) have no bridge to ask.
    if (typeof api?.getEffectiveConfig !== 'function') {
      return
    }
    let current = true
    new Promise<PiWebEffectiveConfig>((resolve) => resolve(api.getEffectiveConfig()))
      .then((value) => {
        if (current) {
          setEffective(value)
        }
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [stored])
  return effective
}

/** On unless switched off; an ORCA_PI_WEB_ENABLED override wins over the stored switch this session. */
export function isPiWebEnabled(
  stored: Partial<PiWebSettings> | undefined,
  effective: PiWebEffectiveConfig | null
): boolean {
  if (effective?.envOverrides.enabled !== undefined) {
    return effective.config.enabled
  }
  return typeof stored?.enabled === 'boolean' ? stored.enabled : DEFAULT_PI_WEB_SETTINGS.enabled
}
