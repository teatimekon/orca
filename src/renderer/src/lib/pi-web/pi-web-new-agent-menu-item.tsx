import type React from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { PiIcon } from '@/lib/agent-icon-glyphs'
import { openPiWebNew } from './open-pi-web'

/** New-agent menu row that opens pi-web's new-conversation composer for the workspace. */
export function PiWebNewAgentMenuItem({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  return (
    <DropdownMenuItem variant="launch" onSelect={() => void openPiWebNew(worktreeId)}>
      <PiIcon size={14} />
      <span className="flex-1">pi-web</span>
    </DropdownMenuItem>
  )
}
