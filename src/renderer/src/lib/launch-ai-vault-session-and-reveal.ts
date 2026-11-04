import { toast } from 'sonner'
import { useAppStore } from '@/store'
import type { AiVaultAgent } from '../../../shared/ai-vault-types'
import { translate } from '@/i18n/i18n'
import { launchAiVaultSessionInNewTab } from './launch-ai-vault-session'
import { activateAiVaultResumeWorkspace } from '@/components/right-sidebar/ai-vault-session-resume-in-chat-launch'
import { notifyAiVaultSessionQueued } from '@/components/right-sidebar/ai-vault-session-launch-feedback'
import { agentLabel } from '@/components/right-sidebar/ai-vault-session-filters'

export async function launchAiVaultSessionAndReveal(
  // The launcher takes any terminal agent; this AI Vault wrapper still names a vault agent for its toasts.
  args: Parameters<typeof launchAiVaultSessionInNewTab>[0] & { agent: AiVaultAgent },
  describeFailure: (message: string) => string = (message) => message
): Promise<void> {
  const launch = launchAiVaultSessionInNewTab(args)
  if (launch.tabId === null) {
    const outcome = await launch.runtimeLaunch
    if (outcome.status === 'failed') {
      toast.error(
        describeFailure(outcome.message) ||
          translate(
            'auto.lib.launch.agent.in.new.tab.11cce5cc77',
            'Could not launch {{value0}} in a new terminal.',
            { value0: agentLabel(args.agent) }
          )
      )
      return
    }
  }
  if (useAppStore.getState().activeWorktreeId !== args.worktreeId) {
    activateAiVaultResumeWorkspace(args.worktreeId)
  }
  notifyAiVaultSessionQueued(args.agent)
}
