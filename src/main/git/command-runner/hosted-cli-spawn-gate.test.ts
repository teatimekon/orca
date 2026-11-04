import { describe, expect, it, vi } from 'vitest'

const execMock = vi.hoisted(() => vi.fn())
vi.mock('./exec-file-capture', () => ({ execFileCaptureToTermination: execMock }))

import { ghExecFileAsync } from './gh-exec-file'
import { glabExecFileAsync } from './glab-exec-file'

describe('hosted CLI spawn gate (pure build, real gate = off)', () => {
  it('never starts gh or glab', async () => {
    await expect(ghExecFileAsync(['auth', 'status'])).rejects.toThrow(/disabled in this build/)
    await expect(glabExecFileAsync(['auth', 'status'])).rejects.toThrow(/disabled in this build/)
    expect(execMock).not.toHaveBeenCalled()
  })
})
