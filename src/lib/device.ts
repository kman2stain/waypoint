/** True when running as an installed home-screen app rather than a browser tab. */
export function isStandalone(): boolean {
  return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Ask the browser not to evict our data under storage pressure.
 * Home-screen apps on iOS are already exempt from Safari's 7-day eviction,
 * but asking costs nothing. Returns the resulting state.
 */
export async function requestPersistentStorage(): Promise<'persistent' | 'best-effort' | 'unknown'> {
  try {
    if (!navigator.storage?.persisted) return 'unknown';
    if (await navigator.storage.persisted()) return 'persistent';
    if (navigator.storage.persist && (await navigator.storage.persist())) return 'persistent';
    return 'best-effort';
  } catch {
    return 'unknown';
  }
}
