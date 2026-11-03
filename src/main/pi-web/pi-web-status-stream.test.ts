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
          ]),
          { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }
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

  it('200 JSON body is incompatible', async () => {
    // An unmodified pi-web routes the path to /api/agent/[id], which answers {"running":false}.
    const body = bodyOf(['{"running":false}'])
    const cancel = vi.spyOn(body, 'cancel')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub implements the fetch surface the stream reads.
    const fetchImpl = (async () =>
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })) as unknown as typeof fetch
    const onFrame = vi.fn()
    const { onClose, closed } = closeSignal()
    openPiWebStatusStream('http://h:1', { onFrame, onClose }, fetchImpl)
    await closed
    expect(onClose).toHaveBeenCalledWith(
      'incompatible',
      expect.stringContaining('application/json')
    )
    expect(onFrame).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalled()
  })

  it('logs a throwing frame handler once per stream and keeps reading', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub implements the fetch surface the stream reads.
      const fetchImpl = (async () =>
        new Response(
          bodyOf([
            'data: {"type":"heartbeat"}\n\n',
            'data: {"type":"removed","id":"a"}\n\n',
            'data: {"type":"removed","id":"b"}\n\n'
          ]),
          { headers: { 'Content-Type': 'text/event-stream' } }
        )) as unknown as typeof fetch
      const onFrame = vi.fn((frame: { type: string }) => {
        if (frame.type === 'removed') {
          throw new Error('reducer bug')
        }
      })
      const { onClose, closed } = closeSignal()
      openPiWebStatusStream('http://h:1', { onFrame, onClose }, fetchImpl)
      await closed
      expect(onFrame).toHaveBeenCalledTimes(3)
      expect(onClose).toHaveBeenCalledWith('ended', undefined)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[pi-web\] /)
      expect(warn.mock.calls[0]).toContainEqual(expect.objectContaining({ message: 'reducer bug' }))
    } finally {
      warn.mockRestore()
    }
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
