import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const cookieValues = vi.hoisted(() => new Map<string, string>())
const cookieStore = vi.hoisted(() => ({
  get: vi.fn((name: string) => {
    const value = cookieValues.get(name)
    return value ? { name, value } : undefined
  }),
  set: vi.fn((cookie: { name: string; value: string }) => {
    cookieValues.set(cookie.name, cookie.value)
  }),
  delete: vi.fn((name: string) => {
    cookieValues.delete(name)
  }),
}))
const cookiesMock = vi.hoisted(() => vi.fn(async () => cookieStore))
const redirectMock = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({ cookies: cookiesMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

describe('acciones de autenticación', () => {
  let auth: typeof import('../auth')
  const fetchMock = vi.fn()

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://backend.example.test'
    vi.stubGlobal('fetch', fetchMock)
    auth = await import('../auth')
  })

  beforeEach(() => {
    fetchMock.mockReset()
    cookieValues.clear()
    cookieStore.set.mockClear()
    cookieStore.delete.mockClear()
    cookieStore.get.mockClear()
    redirectMock.mockReset()
  })

  function successfulResponse(...setCookies: string[]): Response {
    return new Response('{}', {
      status: 200,
      headers: setCookies.map((value): [string, string] => ['set-cookie', value]),
    })
  }

  function responseWithCombinedSetCookie(setCookie: string): Response {
    return {
      status: 200,
      ok: true,
      headers: {
        get: (name: string) => name.toLowerCase() === 'set-cookie' ? setCookie : null,
      },
    } as unknown as Response
  }

  it('inicia sesión local solo después de guardar session_token', async () => {
    fetchMock.mockResolvedValue(successfulResponse(
      'other=value; Path=/',
      'session_token=local-token; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800',
    ))

    await expect(auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123'))
      .resolves.toEqual({ ok: true })

    expect(cookieStore.set).toHaveBeenCalledWith({
      name: 'session_token',
      value: 'local-token',
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60,
    })
    expect(cookieStore.get('session_token')?.value).toBe('local-token')
  })

  it('inicia sesión con Google solo después de guardar session_token', async () => {
    fetchMock.mockResolvedValue(successfulResponse('session_token=google-token; Path=/'))

    await expect(auth.loginWithGoogleAction('google-id-token')).resolves.toEqual({ ok: true })

    expect(cookieValues.get('session_token')).toBe('google-token')
  })

  it.each([
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123')],
    ['Google', () => auth.loginWithGoogleAction('google-id-token')],
  ])('rechaza éxito HTTP sin cookie de sesión en %s', async (_name, action) => {
    fetchMock.mockResolvedValue(successfulResponse('other=value; Path=/'))

    await expect(action()).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('cookie de sesión'),
    })
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it.each([
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123'), 'session_token=; Path=/'],
    ['Google', () => auth.loginWithGoogleAction('google-id-token'), 'session_token=; Path=/'],
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123'), 'session_token=""; Path=/'],
    ['Google', () => auth.loginWithGoogleAction('google-id-token'), 'session_token=""; Path=/'],
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123'), 'other_session_token=wrong; Path=/'],
    ['Google', () => auth.loginWithGoogleAction('google-id-token'), 'other_session_token=wrong; Path=/'],
  ])('rechaza cookie %s en un éxito HTTP: %s', async (_name, action, setCookie) => {
    fetchMock.mockResolvedValue(successfulResponse(setCookie))

    await expect(action()).resolves.toMatchObject({ ok: false })
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it.each([
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123'), 'prefs=one; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/, session_token=token-after; Path=/, tail=value; Path=/'],
    ['Google', () => auth.loginWithGoogleAction('google-id-token'), 'session_token=token-before; Path=/, prefs=one; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/'],
  ])('extrae session_token de headers combinados sin getSetCookie para %s', async (_name, action, setCookie) => {
    fetchMock.mockResolvedValue(responseWithCombinedSetCookie(setCookie))

    await expect(action()).resolves.toEqual({ ok: true })
    expect(cookieValues.get('session_token')).toMatch(/^token-/)
  })

  it('no extrae session_token desde un atributo de otra cookie', async () => {
    fetchMock.mockResolvedValue(responseWithCombinedSetCookie(
      'prefs=one; session_token=attribute-value; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/',
    ))

    await expect(auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123'))
      .resolves.toMatchObject({ ok: false })
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it.each([
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123')],
    ['Google', () => auth.loginWithGoogleAction('google-id-token')],
  ])('propaga fallo al escribir la cookie en %s', async (_name, action) => {
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error('cookie writer failure')
    })
    fetchMock.mockResolvedValue(successfulResponse('session_token=valid-token; Path=/'))

    await expect(action()).resolves.toMatchObject({
      ok: false,
      message: 'No se pudo guardar la sesión. Intentá nuevamente.',
    })
  })

  it.each([
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123')],
    ['Google', () => auth.loginWithGoogleAction('google-id-token')],
  ])('rechaza un writer que no persiste la cookie en %s', async (_name, action) => {
    cookieValues.set('session_token', 'old-token')
    cookieStore.set.mockImplementationOnce(() => undefined)
    fetchMock.mockResolvedValue(successfulResponse('session_token=new-token; Path=/'))

    await expect(action()).resolves.toMatchObject({
      ok: false,
      message: 'No se pudo guardar la sesión. Intentá nuevamente.',
    })
    expect(cookieValues.get('session_token')).toBe('old-token')
  })

  it.each([
    ['local', () => auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123')],
    ['Google', () => auth.loginWithGoogleAction('google-id-token')],
  ])('devuelve error de conexión si falla la red en login %s', async (_name, action) => {
    fetchMock.mockRejectedValue(new Error('network failure'))

    await expect(action()).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('conectar con el servidor'),
    })
  })

  it('devuelve error de conexión si el login agota el timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url: string, options: RequestInit) =>
      new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }),
    )

    const action = auth.loginWithLocalAction('usuario@fermar.com', 'ClaveSegura123')
    await vi.advanceTimersByTimeAsync(8000)
    await expect(action).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('conectar con el servidor'),
    })
    vi.useRealTimers()
  })

  it('envía la cookie entrante al cerrar sesión y limpia la sesión local', async () => {
    cookieValues.set('session_token', 'incoming-token')
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))

    await auth.logoutAction()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.test/api/v1/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { Cookie: 'session_token=incoming-token' },
        signal: expect.any(AbortSignal),
      }),
    )
    expect(cookieStore.delete).toHaveBeenCalledWith('session_token')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('cierra sesión y redirige aunque no exista token o falle HTTP', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }))

    await auth.logoutAction()

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Cookie: 'session_token=' })
    expect(cookieStore.delete).toHaveBeenCalledWith('session_token')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('cierra sesión y redirige si la red falla', async () => {
    cookieValues.set('session_token', 'incoming-token')
    fetchMock.mockRejectedValue(new Error('network failure'))

    await auth.logoutAction()

    expect(cookieStore.delete).toHaveBeenCalledWith('session_token')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('no deja pendiente el cierre de sesión después del timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url: string, options: RequestInit) =>
      new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }),
    )

    const action = auth.logoutAction()
    await vi.advanceTimersByTimeAsync(8000)
    await action

    expect(cookieStore.delete).toHaveBeenCalledWith('session_token')
    expect(redirectMock).toHaveBeenCalledWith('/login')
    vi.useRealTimers()
  })
})
