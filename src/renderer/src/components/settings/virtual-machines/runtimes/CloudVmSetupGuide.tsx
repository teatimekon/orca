import type React from 'react'
import { Cloud } from 'lucide-react'
import { translate } from '@/i18n/i18n'

export function CloudVmSetupGuide({
  refreshAction
}: {
  refreshAction?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-settings-section="cloud-vm-setup">
      <Cloud className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {translate('auto.components.settings.CloudVmSetupGuide.cardTitle', 'Cloud VMs')}
        </div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.CloudVmSetupGuide.cardDescription',
            'Created per workspace from an environment recipe.'
          )}
        </p>
      </div>
      {refreshAction}
    </div>
  )
}
