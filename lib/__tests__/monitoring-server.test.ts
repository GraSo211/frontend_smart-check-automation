import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cookiesMock = vi.hoisted(() => vi.fn())
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({ cookies: cookiesMock }))
vi.stubGlobal('fetch', fetchMock)

import {
  proxyMonitoringEvents,
  proxyMonitoringJson,
} from '@/lib/monitoring-server'

const request = (signal?: AbortSignal) => new Request('https://panel.example/api', { signal })

function upstreamResponse(body: BodyInit | null, status = 200, contentType = 'application/json') {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

describe('proxies internos de monitoreo', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://backend.example'
    fetchMock.mockReset()
    cookiesMock.mockResolvedValue({
      get: () => ({ value: 'session-token' }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rechaza una sesión faltante sin iniciar fetch', async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined })

    const response = await proxyMonitoringJson(request(), '/health', true, false)

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('valida la sesión pero no reenvía la cookie a health', async () => {
    fetchMock.mockResolvedValue(upstreamResponse('{"status":"healthy"}'))

    await proxyMonitoringJson(request(), '/health', true, false)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example/health',
      expect.objectContaining({ headers: {}, cache: 'no-store' }),
    )
  })

  it('reenvía únicamente session_token en endpoints autenticados', async () => {
    fetchMock.mockResolvedValue(upstreamResponse('{"success":true,"data":[]}'))

    await proxyMonitoringJson(request(), '/api/v1/dispositivos', true)

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Cookie: 'session_token=session-token' })
  })

  it.each([503, 404])('conserva el status y body upstream (%s)', async (status) => {
    fetchMock.mockResolvedValue(upstreamResponse('<html>backend</html>', status, 'text/html'))

    const response = await proxyMonitoringJson(request(), '/health', true, false)

    expect(response.status).toBe(status)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toBe('<html>backend</html>')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('no hace network si el request ya fue abortado', async () => {
    const abort = new AbortController()
    abort.abort()

    const response = await proxyMonitoringJson(request(abort.signal), '/health', false)

    expect(response.status).toBe(499)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aplica el timeout también mientras lee JSON', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(
      upstreamResponse(
        new ReadableStream<Uint8Array>({}),
        200,
        'application/json',
      ),
    )

    const pending = proxyMonitoringJson(request(), '/health', false)
    await Promise.resolve()
    vi.advanceTimersByTime(8_001)

    const response = await pending
    expect(response.status).toBe(504)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('mantiene SSE abierto después del timeout de handshake', async () => {
    vi.useFakeTimers()
    let cancelled = false
    fetchMock.mockResolvedValue(
      upstreamResponse(
        new ReadableStream<Uint8Array>({
          cancel() {
            cancelled = true
          },
        }),
        200,
        'text/event-stream',
      ),
    )
    const abort = new AbortController()
    const response = await proxyMonitoringEvents(request(abort.signal), '/events')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store, no-transform')
    const reader = response.body!.getReader()
    const pending = reader.read()
    vi.advanceTimersByTime(8_001)
    await Promise.resolve()
    expect(cancelled).toBe(false)

    abort.abort()
    await pending.catch(() => undefined)
    await Promise.resolve()
    expect(cancelled).toBe(true)
  })

  it('cancela el upstream cuando el consumidor cancela SSE', async () => {
    let cancelled = false
    fetchMock.mockResolvedValue(
      upstreamResponse(
        new ReadableStream<Uint8Array>({
          cancel() {
            cancelled = true
          },
        }),
        200,
        'text/event-stream',
      ),
    )

    const response = await proxyMonitoringEvents(request(), '/events')
    const reader = response.body!.getReader()
    await reader.cancel('consumer closed')

    expect(cancelled).toBe(true)
  })

  it('rechaza y cancela un body con content-type no SSE', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true
      },
    })
    fetchMock.mockResolvedValue(upstreamResponse(body, 200, 'text/html'))

    const response = await proxyMonitoringEvents(request(), '/events')

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    await Promise.resolve()
    expect(cancelled).toBe(true)
  })
})
