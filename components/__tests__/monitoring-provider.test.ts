// @vitest-environment jsdom

import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '@/lib/devices-data'
import type { ProductionRun } from '@/lib/production-data'

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
    ubicacion: 'planta',
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

function run(id: string): ProductionRun {
  return {
    id,
    productoId: 'producto',
    productoNombre: 'Producto',
    turno: 'mañana',
    inicioAt: at,
    finAt: at,
    createdAt: at,
    updatedAt: at,
    totalUnidades: 10,
    correctos: 10,
    quemados: 0,
    crudas: null,
    correctosKg: 1,
    quemadosKg: 0,
    crudosKg: null,
    tempHorno1: 100,
    tempCombHorno1: 100,
    tempHorno2: 100,
    tempCombHorno2: 100,
    velocidadCinta: 1,
  }
}

function Probe({ initialRuns = [], lastSyncAt = null }: { initialRuns?: ProductionRun[]; lastSyncAt?: string | null }) {
  const actions = useMonitoringActions()
  const view = useMonitoring()
  const nodes = useMonitoringNodes()
  const production = useProductionData(initialRuns, lastSyncAt)
  return React.createElement('div', null,
    React.createElement('output', { 'data-testid': 'nodes' }, `${view.nodes.availability}:${view.nodes.online}:${view.nodes.offline}:${view.nodes.unknown}`),
    React.createElement('output', { 'data-testid': 'node-details' }, nodes?.map((item) => `${item.dispositivoId}:${item.estado}:${item.ultimaMetrica?.cpuPct ?? 'none'}`).join(',') ?? ''),
    React.createElement('output', { 'data-testid': 'runs' }, production.runs.map((item) => item.id).join(',')),
    React.createElement('output', { 'data-testid': 'run-count' }, production.runs.length),
    React.createElement('output', { 'data-testid': 'run-values' }, production.runs.map((item) => `${item.id}:${item.totalUnidades}`).join(',')),
    React.createElement('button', { onClick: () => actions.seedNodes([device('a', 'online'), device('b', 'online')], at) }, 'seed'),
    React.createElement('button', { onClick: () => actions.seedNodes([device('a', 'online', 10), device('b', 'online')], '2026-01-01T09:59:00.000Z') }, 'seed-old'),
    React.createElement('button', { onClick: () => actions.seedNodes([device('a', 'online', 10), device('b', 'online')], '2026-01-01T10:01:00.000Z') }, 'seed-t1'),
    React.createElement('button', { onClick: () => { void actions.refreshNodes() } }, 'refresh-nodes'),
    React.createElement('button', { onClick: () => actions.acceptNodeEvent({ data: device('b', 'offline'), success: true }) }, 'event'),
    React.createElement('button', { onClick: () => actions.acceptNodeEvent({ data: device('a', 'offline', 90), success: true }) }, 'event-a'),
    React.createElement('button', { onClick: () => { for (let index = 0; index < 100; index += 1) actions.acceptNodeEvent({ data: device(`other-${index}`, 'online'), success: true }) } }, 'bulk-nodes'),
    React.createElement('button', { onClick: () => actions.acceptLoteEvent({ data: run('live'), success: true }) }, 'lote'),
    React.createElement('button', { onClick: () => actions.acceptLoteEvent({ data: { ...run('same'), totalUnidades: 99 }, success: true }) }, 'stale-live'),
    React.createElement('button', { onClick: () => { for (let index = 0; index < 101; index += 1) actions.acceptLoteEvent({ data: run(`bulk-${index}`), success: true }) } }, 'bulk-lotes'),
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

  it.each([101, 201])('integra el snapshot paginado de %s registros con el provider', async (total) => {
    const rows = Array.from({ length: total }, (_, index) => run(`route-${index}`))
    proxyMonitoringJsonMock.mockImplementation(async (_request: Request, path: string) => {
      const page = Number(new URL(path, 'https://backend.test').searchParams.get('page'))
      return response({
        success: true,
        data: rows.slice((page - 1) * 100, page * 100),
        total,
        page,
        pageSize: 100,
      })
    })

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot', {
      headers: { Cookie: 'session_token=jwt-token' },
    }))
    expect(routeResponse.status).toBe(200)
    const snapshotPayload = await routeResponse.json()
    expect(snapshotPayload.data).toHaveLength(total)
    expect(proxyMonitoringJsonMock).toHaveBeenCalledTimes(Math.ceil(total / 100))
    expect(proxyMonitoringJsonMock).toHaveBeenCalledWith(expect.any(Request), expect.stringContaining('page=1&pageSize=100'), true)
    expect((proxyMonitoringJsonMock.mock.calls[0][0] as Request).headers.get('cookie')).toBe('session_token=jwt-token')

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/lotes/snapshot')) return Promise.resolve(response(snapshotPayload))
      if (String(input).includes('system-status')) return Promise.resolve(response({ status: 'healthy' }))
      return Promise.resolve(response([]))
    }))
    render(React.createElement(MonitoringProvider, null, React.createElement(Probe)))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(screen.getByTestId('run-count').textContent).toBe(String(total))
  })

  it('no publica un snapshot route parcial cuando falla una página posterior', async () => {
    proxyMonitoringJsonMock
      .mockResolvedValueOnce(response({ success: true, data: [run('route-0')], total: 101, page: 1, pageSize: 100 }))
      .mockResolvedValueOnce(response({ success: false, message: 'fallo página 2' }, 503))

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot'))

    expect(routeResponse.status).toBe(503)
    expect(proxyMonitoringJsonMock).toHaveBeenCalledTimes(2)
  })

  it('propaga cancelación del snapshot sin certificar datos', async () => {
    const controller = new AbortController()
    controller.abort()
    proxyMonitoringJsonMock.mockResolvedValue(response({ message: 'cancelada' }, 499))

    const routeResponse = await getLotesSnapshot(new Request('https://panel.test/api/lotes/snapshot', { signal: controller.signal }))

    expect(routeResponse.status).toBe(499)
  })
})
