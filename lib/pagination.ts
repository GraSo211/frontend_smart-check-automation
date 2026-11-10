/**
 * Pagina una colección REST basada en offset. Esto no es un snapshot
 * transaccional: si el backend cambia mientras se consultan las páginas, la
 * colección puede cambiar de posición. Por eso se rechazan cambios de total
 * y páginas sin progreso en vez de publicar una colección parcial.
 */

import { isRecord } from "@/lib/is-record"

export type BackendPage<T> = {
  items: T[]
  total?: number
  page: number
  pageSize: number
  hasMetadata: boolean
}

type ParsePageOptions = {
  requestedPage: number
  requestedPageSize: number
  allowLegacyMetadata?: boolean
}

export type CompleteCollection<T> = {
  items: T[]
  total: number
  page: 1
  pageSize: number
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

/** Parses and validates the backend envelope without accepting partial metadata. */
export function parseBackendPage<T>(
  payload: unknown,
  options: ParsePageOptions,
): BackendPage<T> | null {
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) return null

  const metadataKeys = ['total', 'page', 'pageSize']
  const metadataPresent = metadataKeys.map((key) => key in payload)
  if (metadataPresent.some(Boolean) && !metadataPresent.every(Boolean)) return null

  if (!metadataPresent[0]) {
    if (!options.allowLegacyMetadata || payload.data.length > options.requestedPageSize) return null
    return {
      items: payload.data as T[],
      page: options.requestedPage,
      pageSize: options.requestedPageSize,
      hasMetadata: false,
    }
  }

  const { total, page, pageSize } = payload
  if (!isInteger(total) || total < 0 || !isInteger(page) || page < 1 ||
    !isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
    page !== options.requestedPage || pageSize !== options.requestedPageSize ||
    payload.data.length > pageSize || total < payload.data.length) {
    return null
  }

  return {
    items: payload.data as T[],
    total,
    page,
    pageSize,
    hasMetadata: true,
  }
}

/**
 * Validates the envelope emitted by the frontend snapshot route. Unlike a
 * backend page, its `data` may contain many pages, so it intentionally does
 * not apply the page-size length limit. Metadata is mandatory: a legacy page
 * (including exactly 100 rows) cannot certify a complete snapshot.
 */
export function parseCompleteCollection<T>(
  payload: unknown,
  getId: (item: T) => string,
  expectedPageSize = 100,
): CompleteCollection<T> | null {
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) return null
  if (!isInteger(payload.total) || payload.total < 0 ||
    payload.page !== 1 || payload.pageSize !== expectedPageSize ||
    payload.total !== payload.data.length) return null

  const ids = new Set<string>()
  for (const item of payload.data as T[]) {
    const id = getId(item)
    if (typeof id !== 'string' || id.length === 0 || ids.has(id)) return null
    ids.add(id)
  }
  return {
    items: payload.data as T[],
    total: payload.total,
    page: 1,
    pageSize: payload.pageSize,
  }
}

