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
const tick = () => new Promise((r) => setTimeout(r, 10))

describe('openPiWebStatusStream', () => {
  it('stream parses frames across chunk boundaries', async () => {
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
    const onClose = vi.fn()
    openPiWebStatusStream('http://h:1', { onFrame, onClose }, fetchImpl)
    await tick()
    expect(fetchImpl).toHaveBeenCalledWith('http://h:1/api/agent/status-events', expect.anything())
    expect(onFrame.mock.calls.map((c) => c[0])).toEqual([
      { type: 'heartbeat' },
      { type: 'removed', id: 'a' }
    ])
    expect(onClose).toHaveBeenCalledWith('ended', undefined)
  })

  it('stream reports incompatible on 404', async () => {
    const fetchImpl = (async () => new Response('no', { status: 404 })) as unknown as typeof fetch
    const onClose = vi.fn()
    openPiWebStatusStream('http://h:1', { onFrame: vi.fn(), onClose }, fetchImpl)
    await tick()
    expect(onClose).toHaveBeenCalledWith('incompatible', expect.any(String))
  })

  it('reports error on fetch failure and stays silent after close()', async () => {
    const onClose = vi.fn()
    openPiWebStatusStream('http://h:1', { onFrame: vi.fn(), onClose }, (async () => {
      throw new Error('boom')
    }) as unknown as typeof fetch)
    await tick()
    expect(onClose).toHaveBeenCalledWith('error', 'boom')

    const onClose2 = vi.fn()
    const handle = openPiWebStatusStream(
      'http://h:1',
      { onFrame: vi.fn(), onClose: onClose2 },
      ((_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new Error('aborted')))
        })) as unknown as typeof fetch
    )
    handle.close()
    await tick()
    expect(onClose2).not.toHaveBeenCalled()
  })
})
