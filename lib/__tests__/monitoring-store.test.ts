import { describe, expect, it } from 'vitest'
import {
  confirmDataEvent,
  confirmQuery,
  createInitialMonitoringState,
  nodeStatusFromObservations,
  toMonitoringView,
} from '@/lib/monitoring-store'
import { recordSourceDataEvent, recordSourceQuery } from '@/lib/sync-store'

const at = '2026-01-01T10:00:00.000Z'
const later = '2026-01-01T10:01:00.000Z'
const status = (availability: 'available' | 'degraded' | 'disconnected' | 'unknown', checkedAt = at) => ({
  availability,
  checkedAt,
  detail: availability,
})

describe('monitoring store', () => {
  const device = (dispositivoId: string, estado: 'online' | 'offline') => ({
    dispositivoId,
    nombre: dispositivoId,
    ubicacion: 'planta',
    estado,
    lastSeen: at,
  })

  it('mantiene las transiciones de sincronización monotónicas y separadas', () => {
    const initial = createInitialMonitoringState().sync.lotes
    const withQuery = recordSourceQuery(initial, later)
    const withEvent = recordSourceDataEvent(withQuery, at)

    expect(withEvent.lastQueryAt).toBe(later)
    expect(withEvent.lastDataEventAt).toBe(at)
    expect(withEvent.lastConfirmedAt).toBe(later)
    expect(recordSourceQuery(withEvent, 'not-a-date')).toEqual(withEvent)
    expect(recordSourceDataEvent(withEvent, at)).toEqual(withEvent)
  })

  it('no confirma respuestas inválidas ni eventos de transporte', () => {
    const initial = createInitialMonitoringState().sync.lotes
    expect(confirmQuery(initial, 'malformado')).toEqual(initial)
    expect(confirmDataEvent(initial, 'malformado')).toEqual(initial)
    expect(initial.lastConfirmedAt).toBeNull()
  })

  it('marca la fuente vencida después del TTL', () => {
    const state = createInitialMonitoringState()
    state.backend = status('available', at)
    state.nodes = { ...status('available', at), online: 3, offline: 0, unknown: 0 }
    state.camera = status('available', at)
    const view = toMonitoringView(state, Date.parse(at) + 75_001)
    expect(view.backend.availability).toBe('unknown')
    expect(view.overall.availability).toBe('unknown')
  })

  it('mantiene observaciones por nodo y no renueva el inventario con un evento', () => {
    const observations = {
      a: { device: device('a', 'online'), observedAt: at },
      b: { device: device('b', 'online'), observedAt: at },
    }
    const withEvent = {
      ...observations,
      b: { device: device('b', 'offline'), observedAt: later },
    }

    const view = nodeStatusFromObservations(withEvent, at, Date.parse(later))
    expect(view.online).toBe(1)
    expect(view.offline).toBe(1)
    expect(view.availability).toBe('degraded')
    expect(view.inventoryObservedAt).toBe(at)
  })

  it('vuelve desconocida una observación vencida aunque otro evento sea reciente', () => {
    const view = nodeStatusFromObservations({
      a: { device: device('a', 'online'), observedAt: later },
      b: { device: device('b', 'online'), observedAt: at },
    }, at, Date.parse(at) + 75_001)
    expect(view.online).toBe(1)
    expect(view.unknown).toBe(1)
    expect(view.availability).toBe('unknown')
  })

  it.each([
    ['falla confirmada antes de cámara desconocida', 'disconnected', 'unknown', 'unknown', 'disconnected'],
    ['backend caído y cámara disponible', 'disconnected', 'unknown', 'available', 'degraded'],
    ['todas las fuentes disponibles', 'available', 'available', 'available', 'available'],
    ['sin observación independiente', 'unknown', 'unknown', 'unknown', 'unknown'],
  ])('%s', (_name, backend, nodes, camera, expected) => {
    const state = createInitialMonitoringState()
    state.backend = status(backend as never)
    state.nodes = { ...status(nodes as never), online: 0, offline: 0, unknown: 0 }
    state.camera = status(camera as never)
    expect(toMonitoringView(state, Date.parse(at)).overall.availability).toBe(expected)
  })
})
