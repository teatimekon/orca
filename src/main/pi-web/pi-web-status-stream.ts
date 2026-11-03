import type { PiWebStatusFrame } from '../../shared/pi-web/pi-web-status-types'

export type PiWebStreamHandlers = {
  onFrame(frame: PiWebStatusFrame): void
  onClose(reason: 'incompatible' | 'ended' | 'error', detail?: string): void
}

// Why main-process only: pi-web rejects cross-site Origin, and Node fetch sends none.
export function openPiWebStatusStream(
  baseUrl: string,
  handlers: PiWebStreamHandlers,
  fetchImpl: typeof fetch = fetch
): { close(): void } {
  const controller = new AbortController()
  let closed = false

  const finish = (reason: 'incompatible' | 'ended' | 'error', detail?: string): void => {
    if (closed) {
      return
    }
    closed = true
    handlers.onClose(reason, detail)
  }

  // Why: only the `type` tag is checked here; consumers ignore frame types they do not know.
  const isStatusFrame = (value: unknown): value is PiWebStatusFrame =>
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  let warnedHandlerError = false
  const dispatch = (event: string): void => {
    const data = event
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
      .join('\n')
    if (!data) {
      return
    }
    let frame: unknown
    try {
      frame = JSON.parse(data)
    } catch {
      // Why: one malformed frame must not tear down the stream.
      return
    }
    if (!isStatusFrame(frame)) {
      return
    }
    try {
      handlers.onFrame(frame)
    } catch (error) {
      // Why once: a handler bug fails every frame; the stream keeps going so later frames still land.
      if (!warnedHandlerError) {
        warnedHandlerError = true
        console.warn('[pi-web] status frame handler failed', error)
      }
    }
  }

  void (async () => {
    try {
      const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/api/agent/status-events`, {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' }
      })
      if (res.status === 404) {
        await res.body?.cancel().catch(() => {})
        finish('incompatible', 'status-events route not found')
        return
      }
      // Why: an unmodified pi-web routes the path to /api/agent/[id], which answers 200 JSON.
      const contentType = res.headers.get('content-type') ?? ''
      if (res.ok && contentType.split(';')[0]?.trim().toLowerCase() !== 'text/event-stream') {
        await res.body?.cancel().catch(() => {})
        finish('incompatible', `status-events answered ${contentType || 'no content type'}`)
        return
      }
      if (!res.ok || !res.body) {
        finish('error', `HTTP ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split(/\r?\n\r?\n/)
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!closed) {
            dispatch(part)
          }
        }
      }
      finish('ended')
    } catch (err) {
      if (closed || controller.signal.aborted) {
        return
      }
      finish('error', err instanceof Error ? err.message : String(err))
    }
  })()

  return {
    close() {
      closed = true
      controller.abort()
    }
  }
}
