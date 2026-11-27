# Waypoint

A personal career-tracking app for one person: roadmap, projects, notes, wins log and reminders.
It runs in Safari and installs on an iPhone home screen (PWA). There is no backend.

**Your data stays on your phone** in the browser's storage (IndexedDB), unless you turn on optional
cloud sync to your own private GitHub repo (see below). This repository is public and contains only the
app and a generic example roadmap: no personal data, no secrets, no analytics. The only third-party
network calls are to GitHub, and only when cloud sync is on.

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

Already done a lot before you started using the app? See
[`docs/import-with-ai.md`](docs/import-with-ai.md) for a prompt that has an AI assistant fill in
your milestones, evidence, notes and wins in a backup file you then restore.

## Cloud sync (optional)

Keep your data in a JSON file in a **private** GitHub repo: the app syncs automatically, and an AI
assistant with access to that repo can update your data directly. Setup takes a few minutes: see
[`docs/cloud-sync.md`](docs/cloud-sync.md).

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
- [x] **M3** Notes
- [x] **M4** Reminders (.ics), including a backup reminder
- [x] **M5** Wins log + CV bullet (v1 complete)
- [x] **1.1** Projects tab, projects on milestones
- [x] **1.2** Optional cloud sync to a private GitHub repo
- [x] **1.3** Polish: roadmap overview, collapsible phases, compact wins, roomier forms
- [ ] Later: Progress, Opportunity test
