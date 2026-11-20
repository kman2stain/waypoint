import { useEffect, useRef, useState } from 'preact/hooks';
import { confirmAction } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { remove, put } from '../db/db';
import { useAll } from '../db/hooks';
import { MILESTONE_STATUSES, STATUS_LABELS, type Evidence, type Milestone, type Phase } from '../db/schema';
import { isISODate, todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import { href, navigate, setLeaveGuard } from '../router';

type Draft = Pick<Milestone, 'title' | 'status' | 'targetDate' | 'notes' | 'evidence'>;

const BACK = href('roadmap');

function toDraft(m: Milestone): Draft {
  return {
    title: m.title,
    status: m.status,
    targetDate: m.targetDate,
    notes: m.notes,
    evidence: m.evidence.map((e) => ({ ...e })),
  };
}

const EMPTY: Draft = { title: '', status: 'not_started', targetDate: undefined, notes: '', evidence: [] };

/** Remove empty optional fields so saved records stay tidy. */
function cleanEvidence(e: Evidence): Evidence {
  const out: Evidence = { id: e.id, text: e.text.trim() };
  if (e.date) out.date = e.date;
  if (e.confirmedBy?.trim()) out.confirmedBy = e.confirmedBy.trim();
  return out;
}

export function MilestoneDetail(props: { id?: string; newInPhase?: string }) {
  const milestones = useAll<Milestone>('milestones');
  const phases = useAll<Phase>('phases');
  const existing = props.id ? milestones?.find((m) => m.id === props.id) : undefined;
  const phaseId = existing?.phaseId ?? props.newInPhase;
  const phase = phases?.find((p) => p.id === phaseId);

  const [draft, setDraft] = useState<Draft | null>(null);
  const original = useRef<Draft | null>(null);
  const saving = useRef(false);

  // Initialise the draft once the record has loaded.
  useEffect(() => {
    if (draft || !milestones) return;
    const base = existing ? toDraft(existing) : props.newInPhase ? { ...EMPTY } : null;
    if (base) {
      original.current = JSON.parse(JSON.stringify(base));
      setDraft(base);
    }
  }, [milestones, existing, draft, props.newInPhase]);

  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(original.current);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(
    () =>
      setLeaveGuard(async () => {
        if (!dirtyRef.current || saving.current) return true;
        return confirmAction({
          title: 'Discard changes?',
          body: "Your edits to this milestone haven't been saved.",
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          danger: true,
        });
      }),
    [],
  );

  if (!milestones || !phases) return <p class="muted">Loading…</p>;
  if ((props.id && !existing) || (props.newInPhase && !phase)) {
    return (
      <EmptyState title="Milestone not found">
        <a href={BACK}>Back to Roadmap</a>
      </EmptyState>
    );
  }
  if (!draft) return null;

  // Functional updates: each change applies to the latest draft, so quick
  // successive edits (autofill, paste, fast typing) can't overwrite each other.
  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => update((d) => ({ ...d, [key]: value }));
  const setEvidence = (id: string, patch: Partial<Evidence>) =>
    update((d) => ({ ...d, evidence: d.evidence.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const evidenceValid = draft.evidence.every((e) => e.text.trim() && (!e.date || isISODate(e.date)));
  const valid = draft.title.trim().length > 0 && (!draft.targetDate || isISODate(draft.targetDate)) && evidenceValid;

  const save = async () => {
    if (!valid) return;
    const now = new Date().toISOString();
    const siblings = milestones.filter((m) => m.phaseId === phaseId);
    const record: Milestone = {
      ...(existing ?? {
        id: newId(),
        phaseId: phaseId!,
        order: Math.max(0, ...siblings.map((m) => m.order)) + 1,
        kind: 'task' as const,
        createdAt: now,
      }),
      title: draft.title.trim(),
      status: draft.status,
      notes: draft.notes,
      evidence: draft.evidence.map(cleanEvidence),
      updatedAt: now,
    } as Milestone;
    if (draft.targetDate) record.targetDate = draft.targetDate;
    else delete record.targetDate;

    saving.current = true;
    await put('milestones', record);
    await navigate(BACK);
  };

  const deleteMilestone = async () => {
    if (!existing) return;
    const ok = await confirmAction({
      title: 'Delete this milestone?',
      body: `"${existing.title}" and its evidence will be removed. This can't be undone (unless you restore a backup).`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    saving.current = true;
    await remove('milestones', existing.id);
    await navigate(BACK);
  };

  return (
    <form
      class="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {phase && <p class="muted small" style={{ margin: 0 }}>{phase.title}</p>}
      {existing?.kind === 'gate' && (
        <p class="badge badge-warn" style={{ margin: 0 }}>
          Decision gate{existing.gateMonth !== undefined ? ` · month ${existing.gateMonth}` : ''}
        </p>
      )}

      <label class="field">
        <span class="field-label">Title</span>
        <textarea rows={2} required value={draft.title} onInput={(e) => set('title', e.currentTarget.value)} />
      </label>

      <fieldset class="field seg" role="radiogroup">
        <legend class="field-label">Status</legend>
        <div class="seg-options">
          {MILESTONE_STATUSES.map((s) => (
            <label key={s} class={draft.status === s ? 'seg-option checked' : 'seg-option'}>
              <input type="radio" name="status" value={s} checked={draft.status === s} onChange={() => set('status', s)} />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <div class="field">
        <label class="field-label" for="target-date">
          Target date <span class="muted">(optional)</span>
        </label>
        <div class="inline">
          <input
            id="target-date"
            type="date"
            value={draft.targetDate ?? ''}
            onInput={(e) => set('targetDate', e.currentTarget.value || undefined)}
          />
          {draft.targetDate && (
            <button type="button" class="btn btn-ghost" onClick={() => set('targetDate', undefined)}>
              Clear
            </button>
          )}
        </div>
      </div>

      <label class="field">
        <span class="field-label">Notes</span>
        <textarea rows={5} value={draft.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
      </label>

      <div class="field">
        <h2 class="section-title" style={{ marginTop: '0.5rem' }}>
          Evidence
        </h2>
        <p class="muted small" style={{ marginTop: 0 }}>
          What proves this is done: a written confirmation, a number, a link. Add who confirmed it and when.
        </p>
        {draft.evidence.map((ev, i) => (
          <fieldset class="card evidence" key={ev.id}>
            <legend class="visually-hidden">Evidence {i + 1}</legend>
            <label class="field">
              <span class="field-label">What</span>
              <textarea
                rows={2}
                required
                value={ev.text}
                onInput={(e) => setEvidence(ev.id, { text: e.currentTarget.value })}
              />
            </label>
            <div class="two-col">
              <label class="field">
                <span class="field-label">Date</span>
                <input
                  type="date"
                  value={ev.date ?? ''}
                  onInput={(e) => setEvidence(ev.id, { date: e.currentTarget.value || undefined })}
                />
              </label>
              <label class="field">
                <span class="field-label">Confirmed by</span>
                <input
                  type="text"
                  autoComplete="off"
                  value={ev.confirmedBy ?? ''}
                  onInput={(e) => setEvidence(ev.id, { confirmedBy: e.currentTarget.value })}
                />
              </label>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-danger-text"
              onClick={() => update((d) => ({ ...d, evidence: d.evidence.filter((x) => x.id !== ev.id) }))}
            >
              Remove evidence
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          class="btn"
          onClick={() =>
            update((d) => ({ ...d, evidence: [...d.evidence, { id: newId(), text: '', date: todayISO(), confirmedBy: '' }] }))
          }
        >
          + Add evidence
        </button>
      </div>

      {existing && (
        <div style={{ paddingTop: '1rem' }}>
          <button type="button" class="btn btn-ghost btn-danger-text" onClick={deleteMilestone}>
            Delete milestone
          </button>
        </div>
      )}

      <div class="save-bar">
        <button type="button" class="btn" onClick={() => navigate(BACK)}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={!valid || (!dirty && !!existing)}>
          {existing ? 'Save' : 'Add milestone'}
        </button>
      </div>
    </form>
  );
}
