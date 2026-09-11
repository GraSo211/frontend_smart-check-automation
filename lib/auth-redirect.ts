const INTERNAL_ORIGIN = 'https://smart-check.internal'

function decodeRepeatedly(value: string): string | null {
  let decoded = value

  try {
    for (let i = 0; i < 3; i += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return decoded
      decoded = next
    }
  } catch {
    return null
  }

  return decoded
}

function isAuthPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/') ||
    pathname === '/unauthorized' || pathname.startsWith('/unauthorized/')
}

/** Returns only a safe same-origin path suitable for a post-login redirect. */
export function getSafeInternalRedirect(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/'
  }

  const decoded = decodeRepeatedly(candidate)
  if (
    decoded === null ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(decoded) ||
    /^[a-z][a-z\d+.-]*:/i.test(decoded)
  ) {
    return '/'
  }

  try {
    const parsedDecoded = new URL(decoded, INTERNAL_ORIGIN)
    const parsedCandidate = new URL(candidate, INTERNAL_ORIGIN)
    if (
      parsedDecoded.origin !== INTERNAL_ORIGIN ||
      parsedCandidate.origin !== INTERNAL_ORIGIN ||
      isAuthPath(parsedDecoded.pathname) ||
      isAuthPath(parsedCandidate.pathname)
    ) return '/'
  } catch {
    return '/'
  }

  return candidate
}
