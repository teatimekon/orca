import type React from 'react'
import { translate } from '@/i18n/i18n'
import type { WorkItemSourceSearch } from '../new-workspace/use-work-item-source-search'

export function WorkspaceAttachmentSourceStatus({
  error
}: {
  controller: WorkItemSourceSearch
  error: string | null
}): React.JSX.Element {
  const message =
    error ?? translate('workspace.links.inlineSearchHint', 'Select a result to attach it.')
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
    >
      {message ? <span>{message}</span> : null}
    </div>
  )
}
