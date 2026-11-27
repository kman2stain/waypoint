# Cloud sync

Cloud sync keeps a copy of your Waypoint data in a JSON file in a **private** GitHub repo. The app
syncs on its own, and an AI assistant with access to that repo can update your data directly when you
ask, with no backup files to send back and forth.

The app code lives in this public repo. Your data lives in a **separate private repo**, never in this one.

## Set up (once)

1. **Create the private data repo.** On GitHub: **New repository** → name it `waypoint-data` →
   choose **Private** → **Create repository**. Leave it empty.
2. **Create a token for it.** GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
   - **Repository access:** *Only select repositories* → `waypoint-data`.
   - **Permissions → Repository permissions → Contents:** *Read and write*. Nothing else.
   - **Expiration:** your choice (e.g. 1 year). When it expires, sync shows "GitHub rejected the
     token": make a new one and paste it in **Change settings**.
   - Copy the token (`github_pat_…`).
3. **Connect the app.** In Waypoint: **More → Cloud sync**. Enter `yourname/waypoint-data`, keep the
   file as `waypoint.json`, paste the token, tap **Save and sync**. The first sync uploads what's on
   your phone.
4. **Let your AI assistant reach it.** If the Claude GitHub App only has access to selected repos,
   add `waypoint-data` to it.

The token is stored only on your phone (not in backups). Anyone holding it can read and change the
data repo, so don't share it.

## How it syncs

- When the app opens, when you come back to it, when it's back online, and about 3 seconds after you
  change something. **More → Cloud sync → Sync now** forces one.
- Each sync combines the two copies record by record. A change on one side wins. If the same record
  changed on both sides since the last sync, the later edit (`updatedAt`) wins. Deleting on one side
  deletes on the other, unless the other side edited it meanwhile.
- If the cloud file is invalid, the app changes nothing and shows what's wrong.
- File backups (**Export backup**) still work and are still worth keeping now and then.

## Asking an AI assistant to update your data

Tell it something like: *"Update my Waypoint data in `yourname/waypoint-data`: …"*. Then open
Waypoint and the change appears at the next sync.

Rules for the assistant editing `waypoint.json`:

- The file uses the backup format described in [`import-with-ai.md`](import-with-ai.md); follow its
  truthfulness rules, field formats and record shapes.
- Edit the existing file in place and commit it. Don't rewrite it from an old copy.
- Change only what was asked. **Removing a record deletes it from the phone** at the next sync.
- On every record you add or change, set `updatedAt` to the current time.
- New ids must not clash with existing ones.
- Keep it valid JSON with `"app": "waypoint"` and `"schemaVersion": 1`.
- Never put the file, or any personal data, in the public `waypoint` app repo.

## Turning it off

**More → Cloud sync → Turn off** stops syncing on this phone and forgets the token. Your data stays on
the phone and the file stays in GitHub. To stop all access, also delete the token on GitHub.
