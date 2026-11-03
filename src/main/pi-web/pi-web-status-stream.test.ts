import { describe, expect, it, vi } from 'vitest'
import { openPiWebStatusStream } from './pi-web-status-stream'

function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) {
        c.enqueue(enc.encode(ch))
      }
      c.close()
    }
  })
}
// Resolves once the stream reports close, so tests await the event instead of a real timer.
type CloseHandler = (reason: 'ended' | 'error' | 'incompatible', detail?: string) => void
function closeSignal(): { onClose: ReturnType<typeof vi.fn<CloseHandler>>; closed: Promise<void> } {
  let resolve!: () => void
  const closed = new Promise<void>((r) => {
    resolve = r
  })
  const onClose = vi.fn<CloseHandler>(() => resolve())
  return { onClose, closed }
}
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

describe('openPiWebStatusStream', () => {
  it('stream parses frames across chunk boundaries', async () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub implements the fetch surface the stream reads.
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          bodyOf([
            ':\n\n',
            'data: {"type":"heart',
            'beat"}\n\ndata: nope\n\n',
            'data: {"type":"removed","id":"a"}\r\n\r\n'
          ])
        )
    ) as unknown as typeof fetch
    const onFrame = vi.fn()
    const { onClose, closed } = closeSignal()
    openPiWebStatusStream('http://h:1', { onFrame, onClose }, fetchImpl)
    await closed
    expect(fetchImpl).toHaveBeenCalledWith('http://h:1/api/agent/status-events', expect.anything())
    expect(onFrame.mock.calls.map((c) => c[0])).toEqual([
      { type: 'heartbeat' },
      { type: 'removed', id: 'a' }
    ])
    expect(onClose).toHaveBeenCalledWith('ended', undefined)
  })

  it('stream reports incompatible on 404', async () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub implements the fetch surface the stream reads.
    const fetchImpl = (async () => new Response('no', { status: 404 })) as unknown as typeof fetch
    const { onClose, closed } = closeSignal()
    openPiWebStatusStream('http://h:1', { onFrame: vi.fn(), onClose }, fetchImpl)
    await closed
    expect(onClose).toHaveBeenCalledWith('incompatible', expect.any(String))
  })

  it('reports error on fetch failure and stays silent after close()', async () => {
    const { onClose, closed } = closeSignal()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub implements the fetch surface the stream reads.
    openPiWebStatusStream('http://h:1', { onFrame: vi.fn(), onClose }, (async () => {
      throw new Error('boom')
    }) as unknown as typeof fetch)
    await closed
    expect(onClose).toHaveBeenCalledWith('error', 'boom')

    const onClose2 = vi.fn()
    const handle = openPiWebStatusStream(
      'http://h:1',
      { onFrame: vi.fn(), onClose: onClose2 },
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub implements the fetch surface the stream reads.
      ((_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new Error('aborted')))
        })) as unknown as typeof fetch
    )
    handle.close()
    await flushMicrotasks()
    expect(onClose2).not.toHaveBeenCalled()
  })
})
