// @vitest-environment jsdom

import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '@/lib/devices-data'
import type { ProductionRun } from '@/lib/production-data'
import {
  MonitoringProvider,
  useMonitoring,
  useMonitoringActions,
  useProductionData,
} from '@/components/monitoring-provider'

const at = '2026-01-01T10:00:00.000Z'

function response(payload: unknown, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload } as Response
}

function device(dispositivoId: string, estado: Device['estado']): Device {
  return { dispositivoId, nombre: dispositivoId, ubicacion: 'planta', estado, lastSeen: at }
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
  const production = useProductionData(initialRuns, lastSyncAt)
  return React.createElement('div', null,
    React.createElement('output', { 'data-testid': 'nodes' }, `${view.nodes.availability}:${view.nodes.online}:${view.nodes.offline}:${view.nodes.unknown}`),
    React.createElement('output', { 'data-testid': 'runs' }, production.runs.map((item) => item.id).join(',')),
    React.createElement('button', { onClick: () => actions.seedNodes([device('a', 'online'), device('b', 'online')], at) }, 'seed'),
    React.createElement('button', { onClick: () => actions.acceptNodeEvent({ data: device('b', 'offline'), success: true }) }, 'event'),
    React.createElement('button', { onClick: () => actions.acceptLoteEvent({ data: run('live'), success: true }) }, 'lote'),
  )
}

describe('MonitoringProvider montado', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
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
})
