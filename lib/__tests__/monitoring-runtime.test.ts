import { describe, expect, it } from 'vitest'
import { parseDeviceEventPayload, parseDevicesPayload, parseProductionPayload } from '@/lib/monitoring-runtime'

const metric = {
  id: 'm-1', dispositivoId: 'n-1', cpuPct: 1, memRamDisponibleMb: 2,
  tempChip: 3, aiProcessorPct: 4, receivedAt: '2026-01-01T10:00:00.000Z',
}

const device = { dispositivoId: 'n-1', nombre: 'Nodo 1', ubicacion: 'Línea', estado: 'offline', ultimaMetrica: undefined }
const liveDevice = {
  ...device,
  estado: 'online',
  lastSeen: '2026-01-01T10:00:00.000Z',
  ultimaMetrica: { ...metric, id: '' },
}

const run = {
  id: 'l-1', productoId: 'p-1', productoNombre: 'Producto', turno: 'mañana',
  inicioAt: '2026-01-01T10:00:00.000Z', finAt: '2026-01-01T11:00:00.000Z',
  totalUnidades: 10, correctos: 9, quemados: 1, crudas: null, correctosKg: 1,
  quemadosKg: 1, crudosKg: null, tempHorno1: 100, tempCombHorno1: 20,
  tempHorno2: 100, tempCombHorno2: 20, velocidadCinta: 2,
  createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z',
}

describe('monitoring runtime validation', () => {
  it('acepta snapshots exitosos y rechaza success:false o filas inválidas atómicamente', () => {
    expect(parseDevicesPayload({ success: true, data: [device] })).toHaveLength(1)
    expect(parseDevicesPayload({ success: false, data: [device] })).toBeNull()
    expect(parseDevicesPayload({ success: true, data: [device, { estado: 'online' }] })).toBeNull()
  })

  it('permite un nodo offline nuevo sin lastSeen, pero exige telemetría completa', () => {
    expect(parseDeviceEventPayload(device)?.lastSeen).toBe('')
    expect(parseDeviceEventPayload({ ...device, ultimaMetrica: { ...metric, cpuPct: 'bad' } })).toBeNull()
    expect(parseDeviceEventPayload({ ...device, lastSeen: 'not-a-date' })).toBeNull()
  })

  it('acepta una métrica live con id vacío sin inventar un id persistido', () => {
    expect(parseDevicesPayload({ success: true, data: [liveDevice] })?.[0].ultimaMetrica?.id).toBe('')
    expect(parseDeviceEventPayload({ success: true, data: liveDevice })?.ultimaMetrica?.id).toBe('')
  })

  it('rechaza atómicamente una métrica con un valor numérico inválido', () => {
    const malformed = { ...liveDevice, ultimaMetrica: { ...liveDevice.ultimaMetrica, tempChip: NaN } }
    expect(parseDevicesPayload({ success: true, data: [liveDevice, malformed] })).toBeNull()
  })

  it('exige todos los campos numéricos de lotes', () => {
    expect(parseProductionPayload({ success: true, data: [run] })).toHaveLength(1)
    expect(parseProductionPayload({ success: false, data: [run] })).toBeNull()
    const incomplete = { ...run, totalUnidades: undefined }
    expect(parseProductionPayload([incomplete])).toBeNull()
  })

  it('rechaza fechas de lote inválidas', () => {
    expect(parseProductionPayload({ success: true, data: [{ ...run, finAt: 'not-a-date' }] })).toBeNull()
  })
})
