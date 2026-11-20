# Waypoint — structure and data schema (approved)

Stack: Preact + TypeScript, Vite, `vite-plugin-pwa` (build-time only; generates the service worker
and precache list, makes no network calls at runtime). Hash routing (`#/notes`) and `base: './'`
so the build works under any GitHub Pages path without config.

## 1. File structure

```
waypoint/
├─ .github/workflows/deploy.yml   build + test + publish to GitHub Pages on push to main
├─ .gitignore                     node_modules, dist, .env*, *.local, backups/*.json
├─ README.md                      setup, deploy, iPhone install, backup advice
├─ index.html                     viewport-fit=cover, apple-touch-icon, theme-color (light/dark)
├─ package.json                   preact, vite, typescript, vite-plugin-pwa, vitest
├─ tsconfig.json
├─ vite.config.ts                 base './', PWA manifest, precache everything
├─ public/
│  └─ icons/                      icon-192, icon-512, maskable-512, apple-touch-icon-180 (generated, neutral)
├─ docs/PROPOSAL.md               this file
├─ src/
│  ├─ main.tsx                    mount, ask navigator.storage.persist(), open DB, seed on first run
│  ├─ app.tsx                     shell: bottom tab bar (Roadmap, Notes, Wins, Reminders, More)
│  ├─ router.ts                   tiny hash router
│  ├─ styles.css                  tokens, light/dark via prefers-color-scheme, 44px targets, rem-based type
│  ├─ db/
│  │  ├─ schema.ts                all types below + SCHEMA_VERSION
│  │  ├─ db.ts                    small promise wrapper over IndexedDB (no library)
│  │  ├─ migrations.ts            versioned upgrades
│  │  ├─ seed.ts                  generic roadmap ("my employer", no names)
│  │  └─ backup.ts                export / validate / import
│  ├─ lib/
│  │  ├─ validate.ts              hand-written validators (shared by import, AI proposals, sync)
│  │  ├─ cvBullet.ts              Wins → CV line, placeholders, never computes or invents numbers
│  │  ├─ ics.ts                   RFC 5545 VEVENT + RRULE + VALARM builder
│  │  ├─ share.ts                 Web Share API (files) with download fallback (iOS standalone quirk)
│  │  └─ ids.ts, dates.ts
│  ├─ components/                 Sheet, ConfirmDialog, Field, StatusPill, TagInput, EmptyState
│  └─ screens/
│     ├─ Roadmap.tsx, MilestoneDetail.tsx
│     ├─ Notes.tsx, NoteCapture.tsx
│     ├─ Wins.tsx, WinEdit.tsx
│     ├─ Reminders.tsx, ReminderEdit.tsx
│     ├─ Settings.tsx             export / import / about / (later) sync
│     └─ (later) Progress.tsx, Opportunity.tsx, AiUpdate.tsx
└─ tests/                         vitest: cvBullet, ics, backup validation, seed has no names
```

## 2. Data schema (IndexedDB database `waypoint`, version 1)

Common fields on every record: `id` (crypto.randomUUID), `createdAt`, `updatedAt` (ISO datetime).
Dates without time are `YYYY-MM-DD` strings. Nothing is ever deleted without a confirm dialog.

| Store | Key fields | Indexes |
|---|---|---|
| `meta` | single record: `schemaVersion`, `startDate` (day 1 of the plan, set on first run, editable), `seededAt`, `lastExportAt` | — |
| `phases` | `order` 1–4, `title` ("This month"), `monthsFrom`, `monthsTo` (0–1, 1–6, 6–18, 18–30) | `order` |
| `milestones` | `phaseId`, `order`, `title`, `kind` (`task` \| `gate`), `status` (`not_started` \| `in_progress` \| `done`), `targetDate?`, `notes`, `evidence: Evidence[]` | `phaseId`, `status` |
| `projects` | `name`, `archived` (lightweight, created inline from Notes/Wins) | `name` |
| `notes` | `text`, `tags: string[]`, `milestoneId?`, `projectId?` | `createdAt`, multiEntry `tags` |
| `wins` | `title`, `before?`, `after?` (numbers, only if typed), `unit?`, `date?`, `source?` (source / confirmed by), `context?`, `milestoneId?`, `projectId?` | `date` |
| `reminders` | `title`, `kind` (`weekly_review` \| `study_block` \| `backup` \| `one_off`), `start` (local datetime), `durationMin`, `repeat` `{ freq: none\|daily\|weekly\|monthly, interval, byDay?, until? }`, `alertMinutesBefore: number[]`, `notes?`, `active` | — |
| *later* `studyLogs` | `weekStart` (Monday), `hours` | `weekStart` |
| *later* `decisions` | `title`, `answers { ownsBuild, measurable, coreTech }` (booleans), `verdict` (`take_it` \| `probably_admin`), `note` | `createdAt` |

```ts
interface Evidence { id: string; text: string; date?: string; confirmedBy?: string }
```

Notes on choices:
- **Evidence is a list**, not one field, because a milestone like "collect written impact confirmations" naturally has several.
- **Decision gates** (month 12, month 24) are milestones with `kind: 'gate'` in phases 3 and 4. With `meta.startDate` set, gates and phases show a real calendar month.
- **Wins store numbers as numbers** and the CV builder only interpolates fields that exist. No percentages, no rounding, no direction words it can't justify. No numbers at all → a plain line with no placeholders; only one of the two → the other becomes `[BEFORE: add number]` / `[AFTER: add number]`.
- **Reminders .ics**: one VEVENT per reminder with a stable `UID` (`<id>@waypoint`), floating local time, RRULE from `repeat`, one VALARM per `alertMinutesBefore`.

## 3. Backup / import file (also the future sync format)

```json
{
  "app": "waypoint",
  "schemaVersion": 1,
  "exportedAt": "2026-11-20T09:00:00Z",
  "data": { "meta": {}, "phases": [], "milestones": [], "projects": [],
            "notes": [], "wins": [], "reminders": [], "studyLogs": [], "decisions": [] }
}
```

Import = validate → show counts and what will be replaced → offer "export current data first" →
user confirms → replace all in one transaction. (Merge is out of scope for v1.)

## 4. Later: AI update proposal schema (milestone 8, for reference)

```json
{ "waypointProposal": 1, "changes": [
  { "op": "update_milestone", "id": "...", "set": { "status": "done", "targetDate": "2027-01-31", "notes": "..." } },
  { "op": "add_evidence", "milestoneId": "...", "evidence": { "text": "...", "date": "...", "confirmedBy": "..." } },
  { "op": "add_note", "note": { "text": "...", "tags": ["sql"] } },
  { "op": "add_win", "win": { "title": "...", "before": 40, "after": 10, "unit": "min/day", "source": "..." } }
] }
```
Rejected if: unknown `op` or id, invalid status/date, or `add_win`/`add_evidence` with any number but no `source`/`confirmedBy`.
Shown as a per-change diff with checkboxes; nothing is written until "Apply selected".

## 5. Milestones (one commit each)

| # | Milestone | v1? |
|---|---|---|
| M0 | Scaffold: Vite + Preact + TS, PWA (manifest, icons, offline), theme, tab shell, Actions workflow, README | ✔ |
| M1 | Data layer + seed + Roadmap (status, target date, notes, evidence) | ✔ |
| M2 | Export / Import (done early so data has a backup path from day one), with a "Save to Files" prompt after every export and "last backup" shown in More | ✔ |
| M3 | Notes: quick capture, tags, milestone/project link, search | ✔ |
| M4 | Reminders + .ics export, including a ready-made recurring "Export your Waypoint backup" reminder | ✔ |
| M5 | Wins log + "Copy as CV bullet" | ✔ |

Approved 2026-11-20 with two changes: backup reminder + save-to-Files prompt, and Reminders moved before Wins.
| M6 | Progress: weekly study hours, % per phase | later |
| M7 | Opportunity test | later |
| M8 | AI update (copy status / paste proposal / diff / approve) | later |
| M9 | Optional GitHub sync (separate private repo, fine-grained PAT, conflict prompt) | later |

## 6. iPhone facts that shape the design

- **Installed app and Safari tab have separate storage.** Data entered in Safari won't appear in the home-screen app. README says: install first, then use only the icon.
- Home-screen apps are exempt from Safari's 7-day storage eviction, and the app asks for persistent storage; regular exports are still the real backup.
- Service workers need HTTPS, so iPhone testing happens on the deployed URL, not over local Wi-Fi.
- File downloads from a home-screen app are unreliable on iOS, so Export and .ics use the share sheet (Save to Files / open in Calendar) with a download fallback. To be confirmed on a real iPhone in M2/M5.
