// @vitest-environment jsdom

import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '@/lib/devices-data'
import type { LoteSector } from '@/lib/production-data'

const proxyMonitoringJsonMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/monitoring-server', () => ({ proxyMonitoringJson: proxyMonitoringJsonMock }))

import {
  MonitoringProvider,
  useMonitoring,
  useMonitoringActions,
  useMonitoringNodes,
  useProductionData,
} from '@/components/monitoring-provider'
import { GET as getLotesSnapshot } from '@/app/api/lotes/snapshot/route'

const at = '2026-01-01T10:00:00.000Z'

function response(payload: unknown, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload } as Response
}

function device(dispositivoId: string, estado: Device['estado'], cpuPct?: number): Device {
  return {
    dispositivoId,
    nombre: dispositivoId,
    estado,
    ...(cpuPct === undefined ? {} : {
      ultimaMetrica: {
        id: `metric-${dispositivoId}-${cpuPct}`,
        dispositivoId,
        cpuPct,
        memRamDisponibleMb: 100,
        tempChip: 40,
        aiProcessorPct: 10,
        receivedAt: at,
      },
    }),
    lastSeen: at,
  }
}

function run(id: string, total = 10): LoteSector {
  return {
    id,
    sector_id: 'sector-1',
    estado: 'ABIERTO',
    producto_id: 'producto',
    producto_nombre: 'Producto',
    abierto_en: at,
    abierto_por: { device_id: 'd-1', type: 'ENTRADA_HORNO' },
    conteos: { ok: total, crudo: null, quemado: 0, total },
    ultimo_evento_en: at,
    inactividad_segundos: 1,
  }
}

function runAt(id: string, abiertoEn: string): LoteSector {
  return { ...run(id), abierto_en: abiertoEn }
}

function Probe({ initialRuns = [], lastSyncAt = null }: { initialRuns?: LoteSector[]; lastSyncAt?: string | null }) {
  const actions = useMonitoringActions()
  const view = useMonitoring()
  const nodes = useMonitoringNodes()
  const production = useProductionData(initialRuns, lastSyncAt)
  return React.createElement('div', null,
    React.createElement('output', { 'data-testid': 'nodes' }, `${view.nodes.availability}:${view.nodes.online}:${view.nodes.offline}:${view.nodes.unknown}`),
    React.createElement('output', { 'data-testid': 'node-details' }, nodes?.map((item) => `${item.dispositivoId}:${item.estado}:${item.ultimaMetrica?.cpuPct ?? 'none'}`).join(',') ?? ''),
    React.createElement('output', { 'data-testid': 'runs' }, production.runs.map((item) => item.id).join(',')),
    React.createElement('output', { 'data-testid': 'run-count' }, production.runs.length),
    React.createElement('output', { 'data-testid': 'run-values' }, production.runs.map((item) => `${item.id}:${item.conteos.total}`).join(',')),
    React.createElement('output', { 'data-testid': 'truncated' }, String(production.truncated)),
    React.createElement('button', { onClick: () => actions.seedNodes([device('a', 'online'), device('b', 'online')], at) }, 'seed'),
    React.createElement('button', { onClick: () => actions.seedNodes([device('a', 'online', 10), device('b', 'online')], '2026-01-01T09:59:00.000Z') }, 'seed-old'),
    React.createElement('button', { onClick: () => actions.seedNodes([device('a', 'online', 10), device('b', 'online')], '2026-01-01T10:01:00.000Z') }, 'seed-t1'),
    React.createElement('button', { onClick: () => { void actions.refreshNodes() } }, 'refresh-nodes'),
    React.createElement('button', { onClick: () => actions.acceptNodeEvent({ data: device('b', 'offline'), success: true }) }, 'event'),
    React.createElement('button', { onClick: () => actions.acceptNodeEvent({ data: device('a', 'offline', 90), success: true }) }, 'event-a'),
    React.createElement('button', { onClick: () => { for (let index = 0; index < 100; index += 1) actions.acceptNodeEvent({ data: device(`other-${index}`, 'online'), success: true }) } }, 'bulk-nodes'),
    React.createElement('button', { onClick: () => actions.acceptLoteEvent({ data: run('live'), success: true }) }, 'lote'),
    React.createElement('button', { onClick: () => actions.acceptLoteEvent({ data: run('same', 99), success: true }) }, 'stale-live'),
    React.createElement('button', { onClick: () => { for (let index = 0; index < 101; index += 1) actions.acceptLoteEvent({ data: run(`bulk-${index}`), success: true }) } }, 'bulk-lotes'),
    React.createElement('button', { onClick: () => {
      actions.acceptLoteEvent({ data: runAt('older', '2026-01-01T09:00:00.000Z'), success: true })
      actions.acceptLoteEvent({ data: runAt('newer', '2026-01-01T11:00:00.000Z'), success: true })
    } }, 'ordered-lotes'),
  )
}

describe('MonitoringProvider montado', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    proxyMonitoringJsonMock.mockReset()
  })

  it('deriva el estado del inventario y degrada al recibir un evento offline', async () => {
    vi.setSystemTime(new Date(at))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.includes('system-status')) return response({ status: 'healthy' })
      if (path.includes('nodos')) return new Promise<Response>(() => undefined)
      return response([])
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))

    await act(async () => fireEvent.click(screen.getByText('seed')))
    expect(screen.getByTestId('nodes').textContent).toBe('available:2:0:0')
    await act(async () => fireEvent.click(screen.getByText('event')))
    expect(screen.getByTestId('nodes').textContent).toBe('degraded:1:1:0')
  })

  it('descarta el resultado pendiente de una sesión anterior al cambiar sessionKey', async () => {
    let resolveOld: ((value: Response) => void) | undefined
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve })
    let lotesCalls = 0
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/lotes/snapshot')) {
        lotesCalls += 1
        return lotesCalls === 1 ? oldResponse : Promise.resolve(response([]))
      }
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    const { rerender } = render(React.createElement(
      MonitoringProvider,
      { sessionKey: 'A' },
      React.createElement(Probe, { initialRuns: [run('old')], lastSyncAt: at }),
    ))
    expect(screen.getByTestId('runs').textContent).toContain('old')
    rerender(React.createElement(MonitoringProvider, { sessionKey: 'B' }, React.createElement(Probe)))
    expect(screen.getByTestId('runs').textContent).toBe('')
    await act(async () => resolveOld?.(response({ success: true, data: [run('old')] })))
    expect(screen.getByTestId('runs').textContent).toBe('')
  })

  it('prioriza eventos live durante un snapshot HTTP largo y no pierde más de 100 eventos', async () => {
    let resolveSnapshot: ((value: Response) => void) | undefined
    const snapshot = new Promise<Response>((resolve) => { resolveSnapshot = resolve })
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/lotes/snapshot')) return snapshot
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))

    await act(async () => fireEvent.click(screen.getByText('stale-live')))
    await act(async () => fireEvent.click(screen.getByText('bulk-lotes')))
    expect(screen.getByTestId('runs').textContent).toContain('bulk-100')
    await act(async () => resolveSnapshot?.(response({ success: true, data: [run('same')], total: 1, page: 1, pageSize: 100 })))

    expect(screen.getByTestId('runs').textContent).toContain('bulk-100')
    expect(screen.getByTestId('run-values').textContent).toContain('same:99')
  })

  it('inserta un lote desconocido ordenado por abierto_en descendente', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/lotes/snapshot')) {
        return Promise.resolve(response({ success: true, data: [], total: 0, page: 1, pageSize: 100 }))
      }
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    await act(async () => fireEvent.click(screen.getByText('ordered-lotes')))
    expect(screen.getByTestId('runs').textContent).toBe('newer,older')
  })

  it('conserva un evento de nodo independiente tras un snapshot pendiente y más de 100 eventos', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:01:00.000Z'))
    let resolveSnapshot: ((value: Response) => void) | undefined
    const snapshot = new Promise<Response>((resolve) => { resolveSnapshot = resolve })
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/nodos/snapshot')) return snapshot
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))

    await act(async () => fireEvent.click(screen.getByText('seed')))
    await act(async () => fireEvent.click(screen.getByText('event-a')))
    await act(async () => fireEvent.click(screen.getByText('bulk-nodes')))
    expect(screen.getByTestId('node-details').textContent).toContain('a:offline:90')

    await act(async () => {
      resolveSnapshot?.(response({ success: true, data: [device('a', 'online', 10)] }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('node-details').textContent).toContain('a:offline:90')
    expect(screen.getByTestId('node-details').textContent).toContain('other-99:online:none')
  })

  it('mantiene el journal de nodos tras un refresh fallido para el siguiente refresh', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:01:00.000Z'))
    let nodeCalls = 0
    let resolveSnapshot: ((value: Response) => void) | undefined
    const nextSnapshot = new Promise<Response>((resolve) => { resolveSnapshot = resolve })
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/nodos/snapshot')) {
        nodeCalls += 1
        return nodeCalls === 1 ? Promise.reject(new Error('fallo transitorio')) : nextSnapshot
      }
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    await act(async () => fireEvent.click(screen.getByText('seed')))
    await act(async () => fireEvent.click(screen.getByText('event-a')))
    await act(async () => fireEvent.click(screen.getByText('refresh-nodes')))
    await act(async () => {
      resolveSnapshot?.(response({ success: true, data: [device('a', 'online', 10)] }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('node-details').textContent).toContain('a:offline:90')
  })

  it('conserva eventos posteriores al inicio al aceptar un seed stale más nuevo', async () => {
    const t0 = '2026-01-01T10:00:00.000Z'
    vi.setSystemTime(new Date(t0))
    let resolveSnapshot: ((value: Response) => void) | undefined
    const snapshot = new Promise<Response>((resolve) => { resolveSnapshot = resolve })
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/nodos/snapshot')) return snapshot
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))

    await act(async () => fireEvent.click(screen.getByText('seed-old')))
    vi.setSystemTime(new Date('2026-01-01T10:02:00.000Z'))
    await act(async () => fireEvent.click(screen.getByText('event-a')))
    await act(async () => {
      resolveSnapshot?.(response({ success: true, data: [device('a', 'online', 10)] }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => fireEvent.click(screen.getByText('seed-t1')))
    expect(screen.getByTestId('node-details').textContent).toContain('a:offline:90')
  })

  it.each([101, 201])('integra el snapshot global paginado de %s registros con el provider', async (total) => {
    const rows = Array.from({ length: total }, (_, index) => run(`route-${index}`))
    proxyMonitoringJsonMock.mockImplementation(async (_request: Request, path: string) => {
      if (path.startsWith('/api/v1/sectores')) {
        return response({ success: true, data: [{ id: 's-1', nombre: 'Horno 1' }] })
      }
      const offset = Number(new URL(path, 'https://backend.test').searchParams.get('antes_de') ?? '0')
      const slice = rows.slice(offset, offset + 100)
      const next = offset + 100 < total ? String(offset + 100) : null
      return response({
        success: true,
        data: slice,
        total,
        page: 1,
        pageSize: 100,
        ...(next ? { siguiente_cursor: next } : {}),
      })
    })

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot', {
      headers: { Cookie: 'session_token=jwt-token' },
    }))
    expect(routeResponse.status).toBe(200)
    const snapshotPayload = await routeResponse.json()
    expect(snapshotPayload.data).toHaveLength(total)
    expect(snapshotPayload.truncada).toBe(false)
    expect(proxyMonitoringJsonMock).toHaveBeenCalledTimes(1 + Math.ceil(total / 100))
    expect(proxyMonitoringJsonMock).toHaveBeenCalledWith(expect.any(Request), '/api/v1/sectores', true)
    expect(proxyMonitoringJsonMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.stringContaining('/api/v1/lotes?sector_id=s-1&limite=100'),
      true,
    )
    expect((proxyMonitoringJsonMock.mock.calls[0][0] as Request).headers.get('cookie')).toBe('session_token=jwt-token')

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/lotes/snapshot')) return Promise.resolve(response(snapshotPayload))
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(screen.getByTestId('run-count').textContent).toBe(String(total))
    expect(screen.getByTestId('truncated').textContent).toBe('false')
  })

  it('no publica un snapshot route parcial cuando falla una página posterior', async () => {
    proxyMonitoringJsonMock
      .mockResolvedValueOnce(response({ success: true, data: [{ id: 's-1', nombre: 'Horno 1' }] }))
      .mockResolvedValueOnce(response({ success: true, data: [run('route-0')], total: 101, page: 1, pageSize: 100, siguiente_cursor: '100' }))
      .mockResolvedValueOnce(response({ success: false, message: 'fallo página 2' }, 503))

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot'))

    expect(routeResponse.status).toBe(503)
    expect(proxyMonitoringJsonMock).toHaveBeenCalledTimes(3)
  })

  it('devuelve 502 si los sectores no son válidos y no consulta lotes', async () => {
    proxyMonitoringJsonMock.mockResolvedValueOnce(response({ success: true, data: null }))

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot'))

    expect(routeResponse.status).toBe(502)
    await expect(routeResponse.json()).resolves.toMatchObject({ success: false })
    expect(proxyMonitoringJsonMock).toHaveBeenCalledTimes(1)
  })

  it('marca truncada=true cuando un sector alcanza el tope de páginas con cursor pendiente', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    proxyMonitoringJsonMock.mockImplementation(async (_request: Request, path: string) => {
      if (path.startsWith('/api/v1/sectores')) {
        return response({ success: true, data: [{ id: 's-1', nombre: 'Horno 1' }] })
      }
      const antesDe = new URL(path, 'https://backend.test').searchParams.get('antes_de')
      const pageIndex = antesDe ? Number(antesDe) : 0
      return response({
        success: true,
        data: [run(`capped-${pageIndex}`)],
        total: 20,
        page: 1,
        pageSize: 100,
        siguiente_cursor: String(pageIndex + 1),
      })
    })

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot'))
    expect(routeResponse.status).toBe(200)
    const payload = await routeResponse.json()
    expect(payload.truncada).toBe(true)
    expect(payload.data).toHaveLength(20)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('expone truncated=true del snapshot route en el provider', async () => {
    const snapshotPayload = { success: true, data: [run('t-1')], total: 1, page: 1, pageSize: 100, truncada: true }
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/lotes/snapshot')) return Promise.resolve(response(snapshotPayload))
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(screen.getByTestId('truncated').textContent).toBe('true')
  })

  it('propaga cancelación del snapshot sin certificar datos', async () => {
    const controller = new AbortController()
    controller.abort()
    proxyMonitoringJsonMock.mockResolvedValue(response({ message: 'cancelada' }, 499))

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot', { signal: controller.signal }))

    expect(routeResponse.status).toBe(499)
  })
})
