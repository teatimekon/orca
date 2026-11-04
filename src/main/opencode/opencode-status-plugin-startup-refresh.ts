import { isAgentStatusHooksEnabledForAgent } from '../../shared/agent-status-hooks-setting'
import type { ManagedHookDetectionSettings } from '../agent-hooks/managed-hook-detection-commands'
import { MANAGED_AGENT_HOOK_INSTALLERS } from '../agent-hooks/managed-agent-hook-registry'
import { openCode2HookService, openCodeHookService } from './hook-service'

// Refresh running OpenCode 2 services on upgrade without waiting for a pane to rewrite the plugin.
export function refreshInstalledOpenCodeStatusPlugins(
  settings: ManagedHookDetectionSettings
): void {
  // zyx/orca-pure: only agents in the managed hook registry get their plugin refreshed.
  const managed = (agent: string): boolean =>
    MANAGED_AGENT_HOOK_INSTALLERS.some(([registered]) => registered === agent)
  if (managed('opencode') && isAgentStatusHooksEnabledForAgent(settings, 'opencode')) {
    openCodeHookService.refreshInstalledPlugins()
  }
  if (managed('opencode2') && isAgentStatusHooksEnabledForAgent(settings, 'opencode2')) {
    openCode2HookService.refreshInstalledPlugins()
  }
}
