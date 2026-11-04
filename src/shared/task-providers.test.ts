import { beforeEach, describe, expect, it, vi } from 'vitest'

const gate = vi.hoisted(() => ({ HOSTED_SOURCE_CONTROL_ENABLED: true }))
vi.mock('./pure-hosted-source-control', () => gate)

import {
  filterAvailableTaskProviders,
  normalizeTaskProviderSettings,
  restoreAvailableDefaultTaskProvider
} from './task-providers'

describe('task providers', () => {
  beforeEach(() => {
    gate.HOSTED_SOURCE_CONTROL_ENABLED = true
  })

  it('restores a valid saved default when provider settings drifted', () => {
    expect(
      normalizeTaskProviderSettings({
        visibleTaskProviders: ['linear'],
        defaultTaskSource: 'github'
      })
    ).toEqual({
      defaultTaskSource: 'github',
      visibleTaskProviders: ['github', 'linear']
    })
  })

  it('normalizes invalid saved defaults to the first visible provider', () => {
    expect(
      normalizeTaskProviderSettings({
        visibleTaskProviders: ['gitlab'],
        defaultTaskSource: 'bitbucket'
      })
    ).toEqual({
      defaultTaskSource: 'gitlab',
      visibleTaskProviders: ['gitlab']
    })
  })

  it('filters runtime-unavailable providers without changing preference normalization', () => {
    expect(
      filterAvailableTaskProviders(['github', 'gitlab', 'linear'], {
        gitlabInstalled: false,
        linearConnected: true
      })
    ).toEqual(['github', 'linear'])
  })

  it('keeps an available saved default visible when provider visibility drifted', () => {
    expect(
      restoreAvailableDefaultTaskProvider(
        ['linear'],
        {
          gitlabInstalled: false,
          linearConnected: true
        },
        'github'
      )
    ).toEqual(['github', 'linear'])
  })

  it('preserves intentionally narrowed providers when the saved default matches them', () => {
    expect(
      restoreAvailableDefaultTaskProvider(
        ['linear'],
        {
          gitlabInstalled: false,
          linearConnected: true
        },
        'linear'
      )
    ).toEqual(['linear'])
  })

  it('does not restore an unavailable saved default', () => {
    expect(
      restoreAvailableDefaultTaskProvider(
        ['linear'],
        {
          gitlabInstalled: false,
          linearConnected: true
        },
        'gitlab'
      )
    ).toEqual(['linear'])
  })

  it('ignores invalid saved defaults while restoring visible providers', () => {
    expect(
      restoreAvailableDefaultTaskProvider(
        ['gitlab'],
        {
          gitlabInstalled: false,
          linearConnected: true
        },
        'bitbucket'
      )
    ).toEqual(['github'])
  })

  it('falls back to GitHub when every preferred provider is unavailable', () => {
    expect(
      filterAvailableTaskProviders(['gitlab', 'linear'], {
        gitlabInstalled: false,
        linearConnected: false
      })
    ).toEqual(['github'])
  })

  it('offers only Linear and Jira when hosted source control is off', () => {
    gate.HOSTED_SOURCE_CONTROL_ENABLED = false
    const availability = { gitlabInstalled: true, linearConnected: true }
    expect(
      filterAvailableTaskProviders(['github', 'gitlab', 'linear', 'jira'], availability)
    ).toEqual(['linear', 'jira'])
    expect(filterAvailableTaskProviders(['github'], availability)).toEqual(['jira'])
    expect(
      restoreAvailableDefaultTaskProvider(
        ['github', 'jira'],
        { gitlabInstalled: false, linearConnected: false },
        'github'
      )
    ).toEqual(['jira'])
  })
})
