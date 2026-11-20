import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker. When a new version is downloaded it waits for
 * the user to tap Reload, so an update never interrupts what they're typing.
 */
export function UpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [update, setUpdate] = useState<null | ((reload?: boolean) => Promise<void>)>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const updateSW = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    setUpdate(() => updateSW);
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady]);

  if (needRefresh) {
    return (
      <div class="toast" role="status">
        <p>A new version of Waypoint is ready.</p>
        <button class="btn" onClick={() => update?.(true)}>
          Reload
        </button>
        <button class="btn" onClick={() => setNeedRefresh(false)} aria-label="Later">
          Later
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div class="toast" role="status">
        <p>Waypoint is ready to work offline.</p>
      </div>
    );
  }

  return null;
}
