import { describe, expect, it } from 'vitest'
import { JIRA_METHODS } from './jira'
import { LINEAR_AGENT_ACCESS_METHODS } from './linear-agent-access'
import { LINEAR_METHODS } from './linear'

describe('removed Linear and Jira RPC methods', () => {
  const all = [...LINEAR_METHODS, ...LINEAR_AGENT_ACCESS_METHODS, ...JIRA_METHODS]

  it('keeps 43 linear.* and 28 jira.* RPC names, each answering runtime_unavailable', async () => {
    const names = all.map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.filter((n) => n.startsWith('linear.'))).toHaveLength(43)
    expect(names.filter((n) => n.startsWith('jira.'))).toHaveLength(28)
    for (const method of all) {
      const call = Promise.resolve().then(() =>
        (method.handler as (...args: unknown[]) => unknown)({}, {}, () => {})
      )
      await expect(call, method.name).rejects.toThrow('runtime_unavailable')
    }
  })
})
