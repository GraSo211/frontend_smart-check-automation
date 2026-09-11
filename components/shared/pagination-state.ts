export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages))
}

export function reconcilePage(
  page: number,
  identityChanged: boolean,
  totalChanged: boolean,
  totalPages: number,
): number {
  if (identityChanged) return 1
  return totalChanged ? clampPage(page, totalPages) : page
}
