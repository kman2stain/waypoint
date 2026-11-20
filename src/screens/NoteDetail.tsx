import { useEffect, useRef, useState } from 'preact/hooks';
import { confirmAction } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { TagInput } from '../components/TagInput';
import { useLeaveGuard } from '../components/useLeaveGuard';
import { write, type WriteOp } from '../db/db';
import { useAll } from '../db/hooks';
import type { Milestone, Note, Phase, Project } from '../db/schema';
import { formatDateTime } from '../lib/format';
import { newId } from '../lib/ids';
import { extractHashtags, uniqueTags } from '../lib/tags';
import { href, navigate } from '../router';

const NEW_PROJECT = '__new__';

interface Draft {
  text: string;
  tags: string[];
  milestoneId: string; // '' = none
  projectId: string; // '' = none, NEW_PROJECT = create
  newProjectName: string;
}

/** Where to go after saving / cancelling. */
export function noteBackHref(forMilestone?: string): string {
  return forMilestone ? href('roadmap', 'm', forMilestone) : href('notes');
}

export function NoteDetail(props: { id?: string; isNew?: boolean; forMilestone?: string }) {
  const notes = useAll<Note>('notes');
  const milestones = useAll<Milestone>('milestones');
  const phases = useAll<Phase>('phases');
  const projects = useAll<Project>('projects');
  const existing = props.id ? notes?.find((n) => n.id === props.id) : undefined;
  const back = noteBackHref(props.forMilestone);

  const [draft, setDraft] = useState<Draft | null>(null);
  const original = useRef('');

  useEffect(() => {
    if (draft || !notes) return;
    let base: Draft | null = null;
    if (existing) {
      base = {
        text: existing.text,
        tags: [...existing.tags],
        milestoneId: existing.milestoneId ?? '',
        projectId: existing.projectId ?? '',
        newProjectName: '',
      };
    } else if (props.isNew) {
      base = { text: '', tags: [], milestoneId: props.forMilestone ?? '', projectId: '', newProjectName: '' };
    }
    if (base) {
      original.current = JSON.stringify(base);
      setDraft(base);
    }
  }, [notes, existing, draft, props.isNew, props.forMilestone]);

  const dirty = !!draft && JSON.stringify(draft) !== original.current;
  const bypass = useLeaveGuard(dirty, 'note');

  if (!notes || !milestones || !phases || !projects) return <p class="muted">Loading…</p>;
  if (props.id && !existing) {
    return (
      <EmptyState title="Note not found">
        <a href={href('notes')}>Back to Notes</a>
      </EmptyState>
    );
  }
  if (!draft) return null;

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => update((d) => ({ ...d, [k]: v }));

  const newName = draft.newProjectName.trim();
  const valid = draft.text.trim().length > 0 && (draft.projectId !== NEW_PROJECT || newName.length > 0);
  const hashtagsInText = extractHashtags(draft.text).filter((t) => !draft.tags.includes(t));

  const save = async () => {
    if (!valid) return;
    const now = new Date().toISOString();
    const ops: WriteOp[] = [];

    let projectId: string | undefined = draft.projectId || undefined;
    if (draft.projectId === NEW_PROJECT) {
      // Reuse a project with the same name instead of creating a duplicate.
      const same = projects.find((p) => p.name.toLowerCase() === newName.toLowerCase());
      if (same) projectId = same.id;
      else {
        const project: Project = { id: newId(), name: newName, archived: false, createdAt: now, updatedAt: now };
        ops.push({ type: 'put', store: 'projects', value: project });
        projectId = project.id;
      }
    }

    const text = draft.text.trim();
    const note: Note = {
      id: existing?.id ?? newId(),
      text,
      // New notes pick up #hashtags like quick capture does. When editing, tags
      // stay exactly as chosen so a removed tag doesn't come back.
      tags: uniqueTags(existing ? draft.tags : [...draft.tags, ...extractHashtags(text)]),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (draft.milestoneId) note.milestoneId = draft.milestoneId;
    if (projectId) note.projectId = projectId;
    ops.push({ type: 'put', store: 'notes', value: note });

    await write(ops);
    bypass.current = true;
    await navigate(back);
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAction({
      title: 'Delete this note?',
      body: "This can't be undone (unless you restore a backup).",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await write([{ type: 'delete', store: 'notes', key: existing.id }]);
    bypass.current = true;
    await navigate(back);
  };

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const activeProjects = projects.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form
      class="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {existing && (
        <p class="muted small" style={{ margin: 0 }}>
          Captured {formatDateTime(existing.createdAt)}
          {existing.updatedAt !== existing.createdAt && ` · edited ${formatDateTime(existing.updatedAt)}`}
        </p>
      )}

      <label class="field">
        <span class="field-label">Note</span>
        <textarea rows={6} required value={draft.text} onInput={(e) => set('text', e.currentTarget.value)} />
      </label>

      <div class="field">
        <label class="field-label" for="note-tags">
          Tags
        </label>
        <TagInput id="note-tags" tags={draft.tags} onChange={(tags) => set('tags', tags)} />
        {existing && hashtagsInText.length > 0 && (
          <button
            type="button"
            class="link-button small"
            style={{ marginTop: '0.4rem' }}
            onClick={() => update((d) => ({ ...d, tags: uniqueTags([...d.tags, ...hashtagsInText]) }))}
          >
            Add {hashtagsInText.map((t) => '#' + t).join(' ')} from the text
          </button>
        )}
      </div>

      <label class="field">
        <span class="field-label">
          Milestone <span class="muted">(optional)</span>
        </span>
        <select value={draft.milestoneId} onChange={(e) => set('milestoneId', e.currentTarget.value)}>
          <option value="">None</option>
          {sortedPhases.map((p) => (
            <optgroup key={p.id} label={p.title}>
              {milestones
                .filter((m) => m.phaseId === p.id)
                .sort((a, b) => a.order - b.order)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div class="field">
        <label class="field-label" for="note-project">
          Project <span class="muted">(optional)</span>
        </label>
        <select id="note-project" value={draft.projectId} onChange={(e) => set('projectId', e.currentTarget.value)}>
          <option value="">None</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={NEW_PROJECT}>+ New project…</option>
        </select>
        {draft.projectId === NEW_PROJECT && (
          <input
            type="text"
            style={{ marginTop: '0.5rem' }}
            placeholder="Project name, e.g. PR app"
            aria-label="New project name"
            value={draft.newProjectName}
            onInput={(e) => set('newProjectName', e.currentTarget.value)}
          />
        )}
      </div>

      {existing && (
        <div style={{ paddingTop: '1rem' }}>
          <button type="button" class="btn btn-ghost btn-danger-text" onClick={remove}>
            Delete note
          </button>
        </div>
      )}

      <div class="save-bar">
        <button type="button" class="btn" onClick={() => navigate(back)}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={!valid || (!dirty && !!existing)}>
          {existing ? 'Save' : 'Add note'}
        </button>
      </div>
    </form>
  );
}
