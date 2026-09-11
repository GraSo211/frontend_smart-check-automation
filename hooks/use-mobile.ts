import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function subscribeToMobileMedia(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const mediaQuery = window.matchMedia(MOBILE_QUERY)
  mediaQuery.addEventListener("change", onStoreChange)
  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

export function getMobileSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
}

export function getMobileServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileMedia,
    getMobileSnapshot,
    getMobileServerSnapshot,
  )
}
