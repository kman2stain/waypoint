import { isStandalone } from '../lib/device';

export function More(props: { storage: string }) {
  const standalone = isStandalone();
  const online = navigator.onLine;

  return (
    <div>
      <h2 class="section-title">This device</h2>
      <div class="card">
        <dl class="kv">
          <dt>Running as</dt>
          <dd>{standalone ? 'Installed app' : 'Browser tab'}</dd>
          <dt>Storage</dt>
          <dd>{props.storage}</dd>
          <dt>Network</dt>
          <dd>{online ? 'Online' : 'Offline'}</dd>
          <dt>Version</dt>
          <dd>
            {__APP_VERSION__} ({__BUILD_DATE__})
          </dd>
        </dl>
      </div>

      {!standalone && (
        <>
          <h2 class="section-title">Install on iPhone</h2>
          <div class="card">
            <ol class="steps">
              <li>Open this page in Safari.</li>
              <li>
                Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
              </li>
              <li>Open Waypoint from the new icon and use it only from there.</li>
            </ol>
            <p class="muted" style={{ marginBottom: 0 }}>
              The installed app and this Safari tab keep separate data, so anything entered here won't appear in the
              app.
            </p>
          </div>
        </>
      )}

      <h2 class="section-title">Privacy</h2>
      <div class="card">
        <p style={{ margin: 0 }}>
          Everything you enter stays on this device. Waypoint has no account, no analytics and makes no network calls
          except loading its own files. Backups (Export / Import) arrive in milestone M2.
        </p>
      </div>
    </div>
  );
}
