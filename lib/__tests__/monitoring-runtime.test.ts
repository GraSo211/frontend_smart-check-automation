import { describe, expect, it, vi } from 'vitest'
import { parseDeviceEventPayload, parseDevicesPayload, parseLoteSectorPayload } from '@/lib/monitoring-runtime'

const metric = {
  id: 'm-1', dispositivoId: 'n-1', cpuPct: 1, memRamDisponibleMb: 2,
  tempChip: 3, aiProcessorPct: 4, receivedAt: '2026-01-01T10:00:00.000Z',
}

const device = { dispositivoId: 'n-1', nombre: 'Nodo 1', estado: 'offline', ultimaMetrica: undefined }
const liveDevice = {
  ...device,
  estado: 'online',
  lastSeen: '2026-01-01T10:00:00.000Z',
  ultimaMetrica: { ...metric, id: '' },
}

const lote = {
  id: 'l-1',
  sector_id: 's-1',
  estado: 'ABIERTO',
  producto_id: 'p-1',
  producto_nombre: 'Tostada',
  abierto_en: '2026-01-01T10:00:00.000Z',
  abierto_por: { device_id: 'd-1', type: 'ENTRADA_HORNO' },
  conteos: { ok: 9, crudo: null, quemado: 1, total: 10 },
  ultimo_evento_en: '2026-01-01T10:05:00.000Z',
  inactividad_segundos: 12.5,
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

  it('parsea hasSecret opcional y no invalida el dispositivo por un valor no booleano', () => {
    expect(parseDeviceEventPayload({ ...device, hasSecret: true })?.hasSecret).toBe(true)
    expect(parseDeviceEventPayload({ ...device, hasSecret: false })?.hasSecret).toBe(false)
    expect(parseDeviceEventPayload({ ...device, hasSecret: 42 })?.hasSecret).toBeUndefined()
    expect(parseDeviceEventPayload(device)?.hasSecret).toBeUndefined()
  })

  it('ignora los campos heredados de enrolamiento que ya no existen', () => {
    const legacy = { ...device, keyFingerprint: 'fp-1', enrolledAt: '2026-01-01T09:00:00.000Z', pendingEnrollment: null }
    const parsed = parseDeviceEventPayload(legacy)
    expect(parsed?.dispositivoId).toBe('n-1')
    expect(parsed).not.toHaveProperty('keyFingerprint')
    expect(parsed).not.toHaveProperty('pendingEnrollment')
  })

  it('parsea un whepUrl opcional sin rechazar el dispositivo', () => {
    expect(parseDeviceEventPayload({ ...device, whepUrl: '  https://cam.test/whep  ' })?.whepUrl).toBe('https://cam.test/whep')
    expect(parseDeviceEventPayload({ ...device, whepUrl: '   ' })?.whepUrl).toBeUndefined()
    expect(parseDeviceEventPayload({ ...device, whepUrl: 42 })?.whepUrl).toBeUndefined()
    expect(parseDeviceEventPayload(device)?.whepUrl).toBeUndefined()
  })

  it('no invalida el dispositivo por un whepUrl malformado, pero lo conserva en snapshots válidos', () => {
    expect(parseDeviceEventPayload({ ...device, whepUrl: 'no-es-una-url' })?.dispositivoId).toBe('n-1')
    expect(parseDevicesPayload({ success: true, data: [{ ...liveDevice, whepUrl: 'https://cam.test/whep' }] })?.[0].whepUrl).toBe('https://cam.test/whep')
  })

  it('rechaza atómicamente una métrica con un valor numérico inválido', () => {
    const malformed = { ...liveDevice, ultimaMetrica: { ...liveDevice.ultimaMetrica, tempChip: NaN } }
    expect(parseDevicesPayload({ success: true, data: [liveDevice, malformed] })).toBeNull()
  })

  it('parsea type y sectorId opcionales y los omite si son inválidos sin rechazar el nodo', () => {
    expect(parseDeviceEventPayload({ ...liveDevice, type: 'ENTRADA_HORNO', sectorId: 'horno-1' }))
      .toMatchObject({ type: 'ENTRADA_HORNO', sectorId: 'horno-1' })
    expect(parseDeviceEventPayload({ ...liveDevice, type: 'SALIDA_HORNO' })?.type).toBe('SALIDA_HORNO')
    // `ubicacion` ya no forma parte del contrato del dispositivo.
    expect(parseDeviceEventPayload({ ...liveDevice, ubicacion: 'Línea' })).not.toHaveProperty('ubicacion')
    // Malformed or absent values are omitted without invalidating the device.
    expect(parseDeviceEventPayload({ ...liveDevice, type: 'OTRO', sectorId: '' })).toMatchObject({
      dispositivoId: 'n-1',
    })
    expect(parseDeviceEventPayload({ ...liveDevice, type: 'OTRO', sectorId: '' })).not.toHaveProperty('type')
    expect(parseDeviceEventPayload({ ...liveDevice, type: 'OTRO', sectorId: '' })).not.toHaveProperty('sectorId')
    expect(parseDeviceEventPayload(liveDevice)).not.toHaveProperty('type')
    expect(parseDeviceEventPayload(liveDevice)).not.toHaveProperty('sectorId')
  })

  it('acepta el envelope exitoso y un array crudo de lotes', () => {
    expect(parseLoteSectorPayload({ success: true, data: [lote] })).toEqual([lote])
    expect(parseLoteSectorPayload([lote])).toEqual([lote])
    expect(parseLoteSectorPayload({ success: true, data: [] })).toEqual([])
  })

  it('acepta buckets null y abierto_por/cerrado_en/motivo_cierre ausentes o null', () => {
    const closed = {
      ...lote,
      estado: 'CERRADO',
      abierto_por: null,
      conteos: { ok: null, crudo: null, quemado: 2, total: 2 },
      cerrado_en: '2026-01-01T11:00:00.000Z',
      motivo_cierre: 'sin_detecciones',
    }
    expect(parseLoteSectorPayload([closed])).toHaveLength(1)

    const withoutOptional: Record<string, unknown> = { ...lote }
    delete withoutOptional.abierto_por
    delete withoutOptional.ultimo_evento_en
    expect(parseLoteSectorPayload([withoutOptional])).toHaveLength(1)

    const nullable = { ...lote, abierto_por: null, ultimo_evento_en: null, cerrado_en: null, motivo_cierre: null }
    expect(parseLoteSectorPayload([nullable])).toHaveLength(1)
  })

  it('acepta abierto_por.type vacío o desconocido como lote degradado, no inválido', () => {
    // El backend emite type:"" cuando dispositivos.tipo IS NULL (schema lo permite).
    expect(parseLoteSectorPayload([{ ...lote, abierto_por: { device_id: 'd1', type: '' } }])).toHaveLength(1)
    expect(parseLoteSectorPayload([{ ...lote, abierto_por: { device_id: 'd1', type: 'SALIDA_HORNO' } }])).toHaveLength(1)
    expect(parseLoteSectorPayload([{ ...lote, abierto_por: { device_id: 'd1', type: 'DESCONOCIDO' } }])).toHaveLength(1)
    // device_id sigue siendo obligatorio.
    expect(parseLoteSectorPayload([{ ...lote, abierto_por: { device_id: '', type: '' } }])).toEqual([])
    expect(parseLoteSectorPayload([{ ...lote, abierto_por: { device_id: 'd1', type: 7 } }])).toEqual([])
  })

  it('descarta la fila inválida y conserva las válidas (parser no atómico)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const invalid = { ...lote, id: 'bad-1', estado: 'PENDIENTE' }
    const result = parseLoteSectorPayload({ success: true, data: [lote, invalid, { ...lote, id: 'l-2' }] })
    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result?.map((item) => item.id)).toEqual(['l-1', 'l-2'])
    expect(result?.some((item) => item.id === 'bad-1')).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('rechaza un envelope inválido y devuelve null', () => {
    expect(parseLoteSectorPayload({ success: false, data: [lote] })).toBeNull()
    expect(parseLoteSectorPayload({ success: true, data: null })).toBeNull()
    expect(parseLoteSectorPayload({ success: true, data: { not: 'an array' } })).toBeNull()
  })

  it('rechaza lotes con fechas o conteos inválidos', () => {
    expect(parseLoteSectorPayload([{ ...lote, abierto_en: 'not-a-date' }])).toEqual([])
    expect(parseLoteSectorPayload([{ ...lote, conteos: { ok: 1, crudo: 1, quemado: 1, total: 'x' } }])).toEqual([])
    expect(parseLoteSectorPayload([{ ...lote, abierto_por: { device_id: '', type: 'ENTRADA_HORNO' } }])).toEqual([])
    expect(parseLoteSectorPayload([{ ...lote, estado: 'ABIERTO', cerrado_en: 'not-a-date' }])).toEqual([])
  })
})
