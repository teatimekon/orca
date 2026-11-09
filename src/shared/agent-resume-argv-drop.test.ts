import { describe, expect, it } from 'vitest'
import { retargetClaudeResumeInCommand } from './agent-resume-argv-drop'
import { buildAgentResumeStartupPlan } from './tui-agent-startup'

const SAVED = '11111111-1111-4111-8111-111111111111'
const CONTINUED = '22222222-2222-4222-8222-222222222222'

function claudePlan(platform: NodeJS.Platform, shell?: 'cmd'): string {
  const plan = buildAgentResumeStartupPlan({
    agent: 'claude',
    providerSession: { key: 'session_id', id: SAVED, cwd: '/work/other', effort: 'max' },
    cmdOverrides: {},
    platform,
    ...(shell ? { shell } : {}),
    agentArgs: '--plugin-dir /orca/agent-view',
    launchCwd: '/work/repo'
  })
  if (!plan) {
    throw new Error('expected a claude resume plan')
  }
  return plan.launchCommand
}

describe('retargetClaudeResumeInCommand', () => {
  it.each([
    ['posix', 'darwin', undefined],
    ['powershell', 'win32', undefined],
    ['cmd', 'win32', 'cmd']
  ] as const)('repoints or drops the %s resume selector in place', (_name, platform, shell) => {
    const command = claudePlan(platform, shell)

    const retargeted = retargetClaudeResumeInCommand(command, SAVED, CONTINUED)
    const dropped = retargetClaudeResumeInCommand(command, SAVED, null)

    expect(retargeted).toBe(command.replace(SAVED, CONTINUED))
    expect(dropped).not.toContain(SAVED)
    expect(dropped).not.toContain('--resume')
    expect(dropped).toContain('--effort')
    expect(dropped).toContain('/work/other')
  })

  it('refuses a command without exactly one resume of that session', () => {
    expect(retargetClaudeResumeInCommand(`claude --resume ${CONTINUED}`, SAVED, null)).toBeNull()
    expect(
      retargetClaudeResumeInCommand(`claude --resume ${SAVED} --resume ${SAVED}`, SAVED, null)
    ).toBeNull()
    expect(retargetClaudeResumeInCommand(`claude --resume ${SAVED}0`, SAVED, null)).toBeNull()
  })
})
