# Waypoint

A personal career-tracking app for one person: roadmap, notes, wins log and reminders.
It runs in Safari and installs on an iPhone home screen (PWA). There is no backend.

**Your data never leaves your phone.** It lives in the browser's storage (IndexedDB) on the device.
This repository is public and contains only the app and a generic example roadmap: no personal data,
no secrets, no analytics, no third-party network calls.

## Install on iPhone

1. Open the app's URL (see *Deploy* below) in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open Waypoint **from the new icon** and use it only from there.

> The home-screen app and a Safari tab keep **separate data**. Anything entered in a Safari tab will
> not appear in the installed app. Install first, then use the icon.

Once opened from the icon, the app works offline (try Airplane Mode).
When a new version is deployed, the app shows *"A new version is ready"*; tap **Reload**.

## Backups

Your phone is the only copy of your data. Use **More → Export backup → Save to Files** regularly
and keep the file in iCloud Drive. **More → Restore from backup** checks the file first, shows what it
contains next to what's on the phone, and only replaces your data after you confirm.
Never commit backup files to this repo; `.gitignore` already blocks the usual names.

## Deploy (GitHub Pages)

1. Create a **public** GitHub repository and upload or push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` (install → test → build → publish).
   The URL appears in **Actions** and under **Settings → Pages**, usually
   `https://<your-username>.github.io/<repo-name>/`.

The build uses relative paths and hash routing, so it works under any repo name without config.

## Develop locally

Requires Node.js 24 or newer.

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build in dist/
npm run preview  # serve the production build (service worker active)
npm run icons    # regenerate public/icons
```

Testing on a real iPhone needs the deployed HTTPS URL: service workers don't run over plain
`http://` on your local network.

## Project layout

See [`docs/PROPOSAL.md`](docs/PROPOSAL.md) for the file structure, data schema and milestone plan.

## Milestones

- [x] **M0** Scaffold: PWA shell, offline, icons, light/dark, deploy workflow
- [x] **M1** Roadmap with seed data
- [x] **M2** Export / Import (with Save to Files prompt)
- [ ] **M3** Notes
- [ ] **M4** Reminders (.ics), including a backup reminder
- [ ] **M5** Wins log + CV bullet
- [ ] Later: Progress, Opportunity test, AI update, optional GitHub sync
