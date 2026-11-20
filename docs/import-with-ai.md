# Load your existing history with an AI assistant

Use this when you've already done work you want reflected in Waypoint: milestone statuses,
evidence, notes, projects and wins. Your AI assistant edits your own backup file, and you
restore it in the app. Nothing changes until you tap **Replace my data**, and your original
backup is your undo.

## Steps

1. **Export your current data.** In Waypoint: **More → Export backup → Save to Files**
   (iCloud Drive). Keep this file: it's your undo.
2. **Give it to your AI.** Start a new chat, attach that file, and paste the prompt below.
   Then tell it anything it doesn't already know.
3. **Check its summary.** It lists what it marked done, what it added, and what it wasn't
   sure about. Ask it to fix anything that's wrong before you continue.
4. **Save the file it returns** (`waypoint-backup-import.json`) to Files. If it only shows
   the JSON as text, ask it to "attach that as a downloadable .json file".
5. **Restore.** In Waypoint: **More → Restore from backup** and pick the new file. The
   preview shows how many milestones, evidence items, notes and wins it contains. If that
   looks right, tap **Replace my data**.
6. **If it says "Can't restore this file":** nothing was changed. Screenshot the list of
   problems, give it to the AI and say "Fix these errors in the file".
7. **To undo:** restore the file from step 1.

This file holds your personal data. Keep it in iCloud Drive and never add it to the public
GitHub repo (`.gitignore` already blocks `waypoint-backup*.json`).

---

## The prompt (copy everything below this line)

You are helping me load my real internship history into Waypoint, a personal career-tracking app on my iPhone. I've attached my current Waypoint backup file (JSON). Using what you know about my internship so far, return an updated version of that file that I can restore in the app.

### What to do

1. Go through every milestone in `data.milestones` and update it to match what I've actually done:
   - `status`: `"not_started"`, `"in_progress"` or `"done"`. Use `"done"` only when I've clearly finished it. Use `"in_progress"` if I've started.
   - `targetDate`: only if I have a real deadline.
   - `notes`: one or two plain sentences on where it stands.
   - `evidence`: proof that it happened, e.g. a confirmation email, written manager feedback, a delivered file, a demo, a signed document. Each item has the text, the date, and who confirmed it.
2. If I've done important work that doesn't fit an existing milestone, add a new milestone to the phase it belongs in (`"kind": "task"`).
3. Add a project for each named piece of work (e.g. a dashboard, an app, an automation), so notes and wins can link to it.
4. Add notes for things worth keeping: what I learned, decisions made, feedback I received, open questions, follow-ups. Link each note to a milestone and/or project where it fits, and give it tags.
5. Add wins for concrete results I achieved.
6. If you know when my plan started (the first day of the "This month" phase), set `data.meta.startDate`.

### Truthfulness rules (most important)

- Only use facts I have actually told you. Do not invent, estimate, round, or fill in "typical" values.
- A win's `before` and `after` must be numbers I have explicitly stated. If I didn't give a number, leave that field out completely. The app then shows a `[BEFORE: add number]` placeholder so I can fill it in myself.
- Every win that has a number must have a `source` saying who or what confirms it (e.g. `"Ops manager email, 12 Mar"`). If there is no source, leave the numbers out and describe what you know in `context`.
- No percentages or calculated differences anywhere.
- If you're not sure whether something happened or is finished, don't mark it done. Put it in a note instead and list it in your summary.
- Keep wording plain and honest. No marketing language.

### Keep the file restorable

Restoring **replaces everything** in the app, so the file you return must contain everything: all existing records plus your changes.

- Keep `"app": "waypoint"` and `"schemaVersion": 1`. Keep `appVersion` as it is. Set `exportedAt` to the current time.
- Do not remove or rename any of the 4 phases, and never change an existing `id`.
- Do not delete existing milestones, notes, wins, reminders or projects.
- Leave `data.reminders`, `data.studyLogs` and `data.decisions` exactly as they are.
- Never use `null`. If an optional field has no value, leave the field out.
- Numbers must be JSON numbers (`6`, `0.5`), never strings (`"6"`).
- Don't add fields that aren't listed below, and don't put comments in the JSON.

### Field formats

- Dates: `"YYYY-MM-DD"`, e.g. `"2026-03-14"`.
- Timestamps (`createdAt`, `updatedAt`, `exportedAt`): full ISO time, e.g. `"2026-03-14T09:00:00.000Z"`. For new records, set `createdAt` to roughly when it happened and `updatedAt` to now. When you change an existing record, set its `updatedAt` to now.
- New ids: short unique strings such as `"imp-note-001"`, `"imp-win-001"`, `"imp-ev-001"`, `"imp-proj-001"`, `"imp-ms-001"`. Never reuse an id within the same list.
- Tags: lowercase, no `#`, hyphens instead of spaces, e.g. `"sql"`, `"power-bi"`, `"pl-300"`.
- Links must point at records that exist in the file: a milestone's `phaseId` must be a phase `id`; a note's or win's `milestoneId` must be a milestone `id`; `projectId` must be a project `id`.

### Record shapes (`?` means optional: leave it out if there's no value)

```
milestone: { id, phaseId, order, title, kind: "task" | "gate", gateMonth? (gates only),
             status, targetDate?, notes (text, may be ""), evidence: [...], createdAt, updatedAt }
  New milestones: kind "task", order = one more than the highest order in that phase.

evidence:  { id, text, date?, confirmedBy? }            text is required

project:   { id, name, archived: false, createdAt, updatedAt }

note:      { id, text, tags: [...], milestoneId?, projectId?, createdAt, updatedAt }

win:       { id, title, before?, after?, unit?, date?, source?, context?,
             milestoneId?, projectId?, createdAt, updatedAt }
  title: what I changed or delivered, e.g. "Automated the weekly stock report"
  unit:  e.g. "hours/week", "errors/month", "users"

meta:      { id: "meta", schemaVersion: 1, seededAt (keep as is), startDate?, lastExportAt? (keep as is) }
```

### What to send back

1. A short summary: which milestones you marked done or in progress, how many evidence items, notes, wins and projects you added, and a list of anything you were unsure about and left out.
2. The complete updated JSON as a downloadable file named `waypoint-backup-import.json`. If you can't attach files, give it as a single code block containing only the JSON.
