import type { PiWebRow } from '../../../../shared/pi-web/pi-web-status-types'

/**
 * A pi-web row's title: the label pi-web sends (the session's name, else its first message).
 * Unlabelled, the cwd's last segment, so the row never reads "pi-web - pi-web" beside its type.
 */
export function piWebRowTitle(row: Pick<PiWebRow, 'name' | 'cwd'>): string {
  const name = row.name?.trim()
  if (name) {
    return name
  }
  return (
    row.cwd
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() || 'pi-web'
  )
}
