import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./browser-webauthn-account-picker', () => ({
  requestBrowserWebAuthnAccount: vi.fn(),
  cancelBrowserWebAuthnAccountRequestsForSession: vi.fn()
}))

import { requestBrowserWebAuthnAccount } from './browser-webauthn-account-picker'
import { installBrowserWebAuthnAccessHandlers } from './browser-webauthn-access'

function installFakeSession(): EventEmitter {
  const session = Object.assign(new EventEmitter(), { setDevicePermissionHandler: vi.fn() })
  installBrowserWebAuthnAccessHandlers(session as never)
  return session
}

describe('WebAuthn account selection in the pure build', () => {
  it('cancels at once when several passkeys match', async () => {
    const session = installFakeSession()
    const preventDefault = vi.fn()
    const callback = vi.fn()
    session.emit(
      'select-webauthn-account',
      { preventDefault },
      { accounts: [{ credentialId: 'a' }, { credentialId: 'b' }] },
      callback
    )
    await Promise.resolve()
    expect(preventDefault).toHaveBeenCalled()
    expect(callback).toHaveBeenCalledExactlyOnceWith(null)
    expect(requestBrowserWebAuthnAccount).not.toHaveBeenCalled()
  })

  it('still answers a single passkey with its credential id', async () => {
    const session = installFakeSession()
    const callback = vi.fn()
    session.emit(
      'select-webauthn-account',
      { preventDefault: vi.fn() },
      { accounts: [{ credentialId: 'only' }] },
      callback
    )
    await Promise.resolve()
    expect(callback).toHaveBeenCalledExactlyOnceWith('only')
  })
})
