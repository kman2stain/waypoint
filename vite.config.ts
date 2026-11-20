import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// base './' + hash routing means the same build works at any GitHub Pages path
// (https://<user>.github.io/<repo>/) without configuration.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    preact(),
    VitePWA({
      // 'prompt': a new version waits until the user taps Reload, so an update
      // never interrupts typing.
      registerType: 'prompt',
      injectRegister: false,
      // public/icons/* is already precached via globPatterns below; listing it
      // again in includeAssets would create duplicate precache entries.
      manifest: {
        id: './',
        name: 'Waypoint',
        short_name: 'Waypoint',
        description: 'Personal career roadmap, notes, wins and reminders. Data stays on this device.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#f6f7f9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Icons and the manifest are matched by globPatterns (or added by the
      // plugin), so don't let it add manifest icons a second time.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
