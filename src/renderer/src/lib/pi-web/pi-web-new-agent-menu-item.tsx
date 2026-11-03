import type React from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { PiIcon } from '@/lib/agent-icon-glyphs'
import { useAppStore } from '@/store'
import { openPiWebNew } from './open-pi-web'
import { isPiWebLocalWorkspace } from './pi-web-local-workspace'
import { translate } from '@/i18n/i18n'

/** New-agent menu row that opens pi-web's new-conversation composer for a local workspace. */
export function PiWebNewAgentMenuItem({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const local = useAppStore((state) => isPiWebLocalWorkspace(state, worktreeId))
  if (!local) {
    return null
  }
  return (
    <DropdownMenuItem variant="launch" onSelect={() => void openPiWebNew(worktreeId)}>
      <PiIcon size={14} />
      <span className="flex-1">{translate('piWeb.newAgent.label', 'pi-web')}</span>
    </DropdownMenuItem>
  )
}
