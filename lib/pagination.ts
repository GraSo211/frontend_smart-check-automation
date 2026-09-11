/**
 * Pagina una colección REST basada en offset. Esto no es un snapshot
 * transaccional: si el backend cambia mientras se consultan las páginas, la
 * colección puede cambiar de posición. Por eso se rechazan cambios de total
 * y páginas sin progreso en vez de publicar una colección parcial.
 */

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

type PaginationOptions<T> = {
  pageSize: number
  getId: (item: T) => string
  fetchPage: (page: number) => Promise<BackendPage<T>>
}

export type PaginatedCollection<T> = {
  items: T[]
  total: number
  page: 1
  pageSize: number
}

export type CompleteCollection<T> = {
  items: T[]
  total: number
  page: 1
  pageSize: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

export async function collectPaginatedPages<T>({
  pageSize,
  getId,
  fetchPage,
}: PaginationOptions<T>): Promise<PaginatedCollection<T>> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('Parámetros de paginación inválidos.')
  }

  const byId = new Map<string, T>()
  let expectedTotal: number | undefined
  let metadataMode: boolean | undefined
  let page = 1
  const maxLegacyPages = 1_000

  while (true) {
    const current = await fetchPage(page)
    if (current.page !== page || current.pageSize !== pageSize || current.items.length > pageSize) {
      throw new Error('La API devolvió metadatos de paginación inválidos.')
    }
    if (metadataMode === undefined) metadataMode = current.hasMetadata
    if (metadataMode !== current.hasMetadata) {
      throw new Error('La API cambió el formato de paginación durante la consulta.')
    }
    if (current.hasMetadata) {
      if (current.total === undefined) throw new Error('La API devolvió un total inválido.')
      if (expectedTotal === undefined) expectedTotal = current.total
      if (current.total !== expectedTotal) {
        throw new Error('El total cambió durante la paginación; no se publicó una colección parcial.')
      }
    }

    const previousSize = byId.size
    for (const item of current.items) {
      const id = getId(item)
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error('La API devolvió un elemento sin identificador.')
      }
      byId.set(id, item)
    }

    if (expectedTotal !== undefined) {
      if (byId.size > expectedTotal) {
        throw new Error('La API devolvió más identificadores únicos que el total declarado.')
      }
      if (byId.size >= expectedTotal) {
        return { items: [...byId.values()], total: expectedTotal, page: 1, pageSize }
      }
      if (current.items.length === 0 || byId.size === previousSize) {
        throw new Error('La API no avanzó hasta completar la colección; no se publicó una colección parcial.')
      }
    } else if (current.items.length < pageSize || current.items.length === 0) {
      return { items: [...byId.values()], total: byId.size, page: 1, pageSize }
    } else if (byId.size === previousSize) {
      throw new Error('La API no avanzó durante la paginación; no se publicó una colección parcial.')
    }

    // A stable total bounds the number of offset requests. A legacy response
    // ends on a short page; an all-full legacy sequence is still finite once
    // its first empty page arrives.
    page += 1
    if (expectedTotal !== undefined && page > Math.ceil(expectedTotal / pageSize) + 1) {
      throw new Error('La API excedió el límite esperado de páginas; no se publicó una colección parcial.')
    }
    if (expectedTotal === undefined && page > maxLegacyPages) {
      throw new Error('La respuesta legacy excedió el límite seguro de páginas; no se publicó una colección parcial.')
    }
  }
}
