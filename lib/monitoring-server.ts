import { cookies } from 'next/headers'

export const MONITORING_REQUEST_TIMEOUT_MS = 8_000

const PRIVATE_NO_STORE = 'private, no-store'
const SSE_NO_STORE = 'private, no-store, no-transform'

function apiUrl(): string | null {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || null
}

function timeoutResponse(message: string, status: number): Response {
  return Response.json(
    { message },
    { status, headers: { 'cache-control': PRIVATE_NO_STORE } },
  )
}

function requestController(request: Request): {
  controller: AbortController
  timeout: ReturnType<typeof setTimeout>
  timedOut: () => boolean
  clearTimeout: () => void
  dispose: () => void
  removeAbortListener: () => void
} {
  const controller = new AbortController()
  let didTimeOut = false
  const abort = () => controller.abort(request.signal.reason)
  if (request.signal.aborted) {
    controller.abort(request.signal.reason)
  } else {
    request.signal.addEventListener('abort', abort)
  }
  const timeout = setTimeout(() => {
    didTimeOut = true
    controller.abort()
  }, MONITORING_REQUEST_TIMEOUT_MS)
  let disposed = false
  const removeAbortListener = () => {
    request.signal.removeEventListener('abort', abort)
  }
  return {
    controller,
    timeout,
    timedOut: () => didTimeOut,
    clearTimeout: () => clearTimeout(timeout),
    dispose: () => {
      if (disposed) return
      disposed = true
      clearTimeout(timeout)
      removeAbortListener()
    },
    removeAbortListener,
  }
}

async function sessionHeaders(
  requireSession: boolean,
  forwardSession = requireSession,
): Promise<HeadersInit | Response> {
  if (!requireSession) return {}
  const token = (await cookies()).get('session_token')?.value
  if (!token) return timeoutResponse('Sesión no autenticada.', 401)
  return forwardSession ? { Cookie: `session_token=${token}` } : {}
}

function clientAbortedResponse(): Response {
  return timeoutResponse('La solicitud fue cancelada.', 499)
}

function copyContentType(upstream: Response, headers: Headers): void {
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
}

function readTextUntilAbort(
  upstream: Response,
  requestState: ReturnType<typeof requestController>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      requestState.controller.signal.removeEventListener('abort', onAbort)
      callback()
    }
    const onAbort = () => finish(() => reject(requestState.controller.signal.reason))

    if (requestState.controller.signal.aborted) {
      onAbort()
      return
    }

    requestState.controller.signal.addEventListener('abort', onAbort)
    void upstream.text().then(
      (body) => finish(() => resolve(body)),
      (error) => finish(() => reject(error)),
    )
  })
}

export async function proxyMonitoringJson(
  request: Request,
  path: string,
  requireSession: boolean,
  forwardSession = requireSession,
): Promise<Response> {
  if (request.signal.aborted) return clientAbortedResponse()

  const headers = await sessionHeaders(requireSession, forwardSession)
  if (headers instanceof Response) return headers

  if (request.signal.aborted) return clientAbortedResponse()

  const baseUrl = apiUrl()
  if (!baseUrl) return timeoutResponse('El servicio no está configurado.', 500)

  const requestState = requestController(request)
  try {
    const upstream = await fetch(`${baseUrl}${path}`, {
      headers,
      cache: 'no-store',
      signal: requestState.controller.signal,
    })
    if (requestState.controller.signal.aborted) {
      throw requestState.controller.signal.reason
    }
    const body = await readTextUntilAbort(upstream, requestState)
    const responseHeaders = new Headers()
    copyContentType(upstream, responseHeaders)
    responseHeaders.set('cache-control', PRIVATE_NO_STORE)

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    if (request.signal.aborted) return clientAbortedResponse()
    if (requestState.timedOut() || (error instanceof Error && error.name === 'AbortError')) {
      return timeoutResponse('El backend no respondió a tiempo.', 504)
    }
    return timeoutResponse('No se pudo contactar desde panel.', 502)
  } finally {
    requestState.dispose()
  }
}

function cancelBody(body: ReadableStream<Uint8Array> | null): void {
  if (!body) return
  try {
    void body.cancel().catch(() => undefined)
  } catch {
    // El body puede haber sido cancelado por fetch al mismo tiempo.
  }
}

export async function proxyMonitoringEvents(request: Request, path: string): Promise<Response> {
  if (request.signal.aborted) return clientAbortedResponse()

  const headers = await sessionHeaders(true)
  if (headers instanceof Response) return headers

  if (request.signal.aborted) return clientAbortedResponse()

  const baseUrl = apiUrl()
  if (!baseUrl) return timeoutResponse('El servicio no está configurado.', 500)

  const requestState = requestController(request)
  let streamOwnsRequestState = false
  try {
    const upstream = await fetch(`${baseUrl}${path}`, {
      headers: { ...headers, Accept: 'text/event-stream' },
      cache: 'no-store',
      signal: requestState.controller.signal,
    })
    if (requestState.controller.signal.aborted) {
      throw requestState.controller.signal.reason
    }

    if (!upstream.ok) {
      const body = await readTextUntilAbort(upstream, requestState)
      const responseHeaders = new Headers({
        'cache-control': PRIVATE_NO_STORE,
      })
      copyContentType(upstream, responseHeaders)
      return new Response(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      })
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!upstream.body || !contentType.toLowerCase().includes('text/event-stream')) {
      cancelBody(upstream.body)
      return timeoutResponse('El stream del backend devolvió una respuesta inválida.', 502)
    }

    const reader = upstream.body.getReader()
    // El timeout sólo protege el handshake. Un SSE válido puede vivir indefinidamente.
    requestState.clearTimeout()

    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined
    let finished = false
    let readerCancellation: Promise<void> | undefined
    let abortStream = () => undefined

    const releaseReader = () => {
      try {
        reader.releaseLock()
      } catch {
        // releaseLock puede ejecutarse después de que el reader ya fue liberado.
      }
    }
    const detach = () => {
      request.signal.removeEventListener('abort', abortUpstream)
      requestState.dispose()
    }
    const cleanup = () => {
      detach()
      releaseReader()
    }
    const cancelReader = (reason?: unknown): Promise<void> => {
      if (!readerCancellation) {
        try {
          readerCancellation = Promise.resolve(reader.cancel(reason)).catch(() => undefined).then(() => {
            releaseReader()
          })
        } catch {
          readerCancellation = Promise.resolve().then(releaseReader)
        }
      }
      return readerCancellation
    }
    abortStream = () => {
      if (finished) return
      finished = true
      const reason = request.signal.reason
      requestState.controller.abort(reason)
      try {
        streamController?.error(reason ?? new DOMException('La solicitud fue cancelada.', 'AbortError'))
      } catch {
        // El consumidor puede haber cancelado/cerrado el stream ya.
      }
      const cancellation = cancelReader(reason)
      detach()
      void cancellation.then(releaseReader)
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
      async pull(controller) {
        if (finished) return
        try {
          const result = await reader.read()
          if (result.done) {
            finished = true
            cleanup()
            controller.close()
          } else if (!finished) {
            controller.enqueue(result.value)
          }
        } catch (error) {
          if (!finished) {
            finished = true
            try {
              controller.error(error)
            } catch {
              // El consumidor puede haber cancelado durante reader.read().
            }
          }
          const cancellation = cancelReader(error)
          detach()
          void cancellation.then(releaseReader)
        }
      },
      async cancel(reason) {
        if (!finished) {
          finished = true
          requestState.controller.abort(reason)
        }
        const cancellation = cancelReader(reason)
        detach()
        try {
          await cancellation
        } finally {
          releaseReader()
        }
      },
    })

    function abortUpstream() {
      abortStream()
    }

    request.signal.addEventListener('abort', abortUpstream)
    if (request.signal.aborted) abortUpstream()
    streamOwnsRequestState = true

    return new Response(stream, {
      status: upstream.status,
      headers: {
        'content-type': contentType,
        'cache-control': SSE_NO_STORE,
        connection: 'keep-alive',
      },
    })
  } catch (error) {
    if (request.signal.aborted) return clientAbortedResponse()
    if (requestState.timedOut() || (error instanceof Error && error.name === 'AbortError')) {
      return timeoutResponse('El backend no respondió a tiempo.', 504)
    }
    return timeoutResponse('No se pudo contactar desde panel.', 502)
  } finally {
    // Un SSE válido owns requestState; cleanup runs when it closes or is cancelled.
    if (!streamOwnsRequestState) requestState.dispose()
  }
}
