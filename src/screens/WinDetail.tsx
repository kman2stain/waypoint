import { useEffect, useRef, useState } from 'preact/hooks';
import { BulletText } from '../components/BulletText';
import { confirmAction } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MilestoneSelect, ProjectSelect, projectChoiceValid, resolveProject } from '../components/LinkFields';
import { useLeaveGuard } from '../components/useLeaveGuard';
import { write, type WriteOp } from '../db/db';
import { useAll } from '../db/hooks';
import type { Milestone, Phase, Project, Win } from '../db/schema';
import { copyText } from '../lib/clipboard';
import { buildCvBullet } from '../lib/cvBullet';
import { isISODate, todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import { formatNumber, parseUserNumber } from '../lib/numbers';
import { href, navigate } from '../router';

interface Draft {
  title: string;
  before: string;
  after: string;
  unit: string;
  date: string;
  source: string;
  context: string;
  milestoneId: string;
  projectId: string;
  newProjectName: string;
}

function toDraft(w: Win): Draft {
  return {
    title: w.title,
    before: w.before !== undefined ? formatNumber(w.before) : '',
    after: w.after !== undefined ? formatNumber(w.after) : '',
    unit: w.unit ?? '',
    date: w.date ?? '',
    source: w.source ?? '',
    context: w.context ?? '',
    milestoneId: w.milestoneId ?? '',
    projectId: w.projectId ?? '',
    newProjectName: '',
  };
}

function NumberField(props: { id: string; label: string; value: string; onInput: (v: string) => void }) {
  const parsed = parseUserNumber(props.value);
  const errId = `${props.id}-err`;
  return (
    <div class="field">
      <label class="field-label" for={props.id}>
        {props.label} <span class="muted">(optional)</span>
      </label>
      <input
        id={props.id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={props.value}
        aria-invalid={parsed.kind === 'error'}
        aria-describedby={parsed.kind === 'error' ? errId : undefined}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
      {parsed.kind === 'error' && (
        <p id={errId} class="error-text small" style={{ marginTop: '0.3rem' }}>
          {parsed.message}
        </p>
      )}
    </div>
  );
}

export function WinDetail(props: { id?: string; isNew?: boolean; back?: string }) {
  const back = props.back ?? href('wins');
  const wins = useAll<Win>('wins');
  const milestones = useAll<Milestone>('milestones');
  const phases = useAll<Phase>('phases');
  const projects = useAll<Project>('projects');
  const existing = props.id ? wins?.find((w) => w.id === props.id) : undefined;

  const [draft, setDraft] = useState<Draft | null>(null);
  const original = useRef('');
  const [copyMsg, setCopyMsg] = useState('');

  useEffect(() => {
    if (draft || !wins) return;
    const base: Draft | null = existing
      ? toDraft(existing)
      : props.isNew
        ? { title: '', before: '', after: '', unit: '', date: todayISO(), source: '', context: '', milestoneId: '', projectId: '', newProjectName: '' }
        : null;
    if (base) {
      original.current = JSON.stringify(base);
      setDraft(base);
    }
  }, [wins, existing, draft, props.isNew]);

  const dirty = !!draft && JSON.stringify(draft) !== original.current;
  const bypass = useLeaveGuard(dirty, 'win');

  if (!wins || !milestones || !phases || !projects) return <p class="muted">Loading…</p>;
  if (props.id && !existing) {
    return (
      <EmptyState title="Win not found">
        <a href={href('wins')}>Back to Wins</a>
      </EmptyState>
    );
  }
  if (!draft) return null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setCopyMsg('');
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  };

  const before = parseUserNumber(draft.before);
  const after = parseUserNumber(draft.after);
  const valid =
    draft.title.trim().length > 0 &&
    before.kind !== 'error' &&
    after.kind !== 'error' &&
    (!draft.date || isISODate(draft.date)) &&
    projectChoiceValid(draft.projectId, draft.newProjectName);

  const fields = {
    title: draft.title.trim() || '[WHAT: describe the change]',
    before: before.kind === 'ok' ? before.value : undefined,
    after: after.kind === 'ok' ? after.value : undefined,
    unit: draft.unit,
    date: draft.date || undefined,
    source: draft.source,
  };
  const bullet = buildCvBullet(fields);
  const hasNumbers = fields.before !== undefined || fields.after !== undefined;

  const save = async () => {
    if (!valid) return;
    const now = new Date().toISOString();
    const { projectId, ops: projectOps } = resolveProject(draft.projectId, draft.newProjectName, projects, now);
    const win: Win = {
      id: existing?.id ?? newId(),
      title: draft.title.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (fields.before !== undefined) win.before = fields.before;
    if (fields.after !== undefined) win.after = fields.after;
    if (draft.unit.trim()) win.unit = draft.unit.trim();
    if (draft.date) win.date = draft.date;
    if (draft.source.trim()) win.source = draft.source.trim();
    if (draft.context.trim()) win.context = draft.context.trim();
    if (draft.milestoneId) win.milestoneId = draft.milestoneId;
    if (projectId) win.projectId = projectId;
    const ops: WriteOp[] = [...projectOps, { type: 'put', store: 'wins', value: win }];
    await write(ops);
    bypass.current = true;
    await navigate(back);
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAction({
      title: 'Delete this win?',
      body: "This can't be undone (unless you restore a backup).",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await write([{ type: 'delete', store: 'wins', key: existing.id }]);
    bypass.current = true;
    await navigate(back);
  };

  const copy = async () => {
    const ok = await copyText(bullet.text);
    setCopyMsg(
      !ok
        ? "Couldn't copy. Press and hold the text to copy it."
        : bullet.missing.length || !draft.title.trim()
          ? 'Copied. Fill in the highlighted placeholders before using it.'
          : 'Copied.',
    );
  };

  return (
    <form
      class="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label class="field">
        <span class="field-label">What did you change or deliver?</span>
        <textarea
          rows={2}
          required
          placeholder="e.g. Automated the weekly stock report"
          value={draft.title}
          onInput={(e) => set('title', e.currentTarget.value)}
        />
      </label>

      <div class="two-col">
        <NumberField id="win-before" label="Before" value={draft.before} onInput={(v) => set('before', v)} />
        <NumberField id="win-after" label="After" value={draft.after} onInput={(v) => set('after', v)} />
      </div>

      <label class="field">
        <span class="field-label">
          Unit <span class="muted">(optional)</span>
        </span>
        <input
          type="text"
          placeholder="e.g. hours/week, errors/month, users"
          value={draft.unit}
          onInput={(e) => set('unit', e.currentTarget.value)}
        />
      </label>

      <div class="two-col">
        <label class="field">
          <span class="field-label">
            Date <span class="muted">(optional)</span>
          </span>
          <input type="date" value={draft.date} onInput={(e) => set('date', e.currentTarget.value)} />
        </label>
        <label class="field">
          <span class="field-label">
            Source / confirmed by <span class="muted">(optional)</span>
          </span>
          <input
            type="text"
            placeholder="e.g. Ops manager, email 12 Mar"
            value={draft.source}
            onInput={(e) => set('source', e.currentTarget.value)}
          />
        </label>
      </div>

      {hasNumbers && !draft.source.trim() && (
        <p class="muted small" style={{ margin: 0 }}>
          Tip: add who confirmed these numbers, so they hold up when someone asks.
        </p>
      )}

      <label class="field">
        <span class="field-label">
          Context <span class="muted">(optional, not in the CV line)</span>
        </span>
        <textarea rows={3} value={draft.context} onInput={(e) => set('context', e.currentTarget.value)} />
      </label>

      <MilestoneSelect value={draft.milestoneId} phases={phases} milestones={milestones} onChange={(v) => set('milestoneId', v)} />
      <ProjectSelect
        id="win-project"
        value={draft.projectId}
        newName={draft.newProjectName}
        projects={projects}
        onChange={(v) => set('projectId', v)}
        onNewName={(v) => set('newProjectName', v)}
      />

      <div class="card stack">
        <h2 class="section-title" style={{ margin: 0 }}>
          CV bullet preview
        </h2>
        <p style={{ margin: 0 }}>
          <BulletText text={bullet.text} />
        </p>
        <p class="muted small" style={{ margin: 0 }}>
          Built only from the fields above; nothing is estimated. Leave both numbers empty for a win without a before and
          after. If you fill in only one, the other stays as a highlighted placeholder.
        </p>
        <div class="capture-row">
          <span class="muted small" role="status" aria-live="polite">
            {copyMsg}
          </span>
          <button type="button" class="btn" onClick={copy}>
            Copy as CV bullet
          </button>
        </div>
      </div>

      {existing && (
        <div style={{ paddingTop: '0.5rem' }}>
          <button type="button" class="btn btn-ghost btn-danger-text" onClick={remove}>
            Delete win
          </button>
        </div>
      )}

      <div class="save-bar">
        <button type="button" class="btn" onClick={() => navigate(back)}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={!valid || (!dirty && !!existing)}>
          {existing ? 'Save' : 'Add win'}
        </button>
      </div>
    </form>
  );
}
