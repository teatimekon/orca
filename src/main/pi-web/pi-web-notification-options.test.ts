import { describe, expect, it } from 'vitest'
import { buildNotificationOptions } from '../ipc/notification-options'

// The request shape the renderer's pi-web dispatch sends (pi-web-attention-dispatch.ts).
const piWebRequest = {
  source: 'agent-task-complete',
  surface: 'pi-web',
  piWebSessionId: 'session-1',
  agentType: 'pi-web',
  agentState: 'done',
  worktreeId: 'repo1::/x/hw_experiment',
  terminalTitle: 'Fix the flaky test',
  agentLastAssistantMessage: 'Fix the flaky test',
  repoLabel: 'code',
  worktreeLabel: 'hw_experiment'
} as const

describe('pi-web notification copy', () => {
  it('the banner body names the conversation', () => {
    const options = buildNotificationOptions(piWebRequest)
    expect(options.title).toBe('code / hw_experiment - pi-web finished')
    expect(options.body).toBe('Fix the flaky test')
  })

  it('an unlabelled conversation keeps the generic body', () => {
    const { agentLastAssistantMessage: _label, ...unlabelled } = piWebRequest
    expect(buildNotificationOptions({ ...unlabelled, terminalTitle: 'pi-web' }).body).toBe(
      'pi-web finished.'
    )
  })
})
