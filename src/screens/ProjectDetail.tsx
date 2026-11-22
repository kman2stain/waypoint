import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { confirmAction } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Link } from '../components/Link';
import { ProjectNameModal } from '../components/ProjectNameModal';
import { Chevron, StatusIcon } from '../components/StatusIcon';
import { put, write } from '../db/db';
import { useAll } from '../db/hooks';
import { STATUS_LABELS, type Milestone, type Note, type Phase, type Project, type Win } from '../db/schema';
import { formatDate } from '../lib/dates';
import { formatDateTime, plural } from '../lib/format';
import { formatNumber } from '../lib/numbers';
import { deleteProjectOps, projectItems } from '../lib/projects';
import { href, hrefFromProject, navigate } from '../router';
import { winSortKey } from './Wins';

function winNumbers(w: Win): string | null {
  if (w.before === undefined && w.after === undefined) return null;
  const show = (n?: number) => (n === undefined ? '?' : formatNumber(n));
  return `${show(w.before)} → ${show(w.after)}${w.unit ? ` ${w.unit}` : ''}`;
}

function Section(props: { title: string; count: number; empty: string; children: ComponentChildren }) {
  return (
    <section>
      <h2 class="section-title">
        {props.title} {props.count > 0 && `(${props.count})`}
      </h2>
      {props.count ? <ul class="list">{props.children}</ul> : <p class="muted small">{props.empty}</p>}
    </section>
  );
}

export function ProjectDetail(props: { id: string }) {
  const projects = useAll<Project>('projects');
  const milestones = useAll<Milestone>('milestones');
  const phases = useAll<Phase>('phases');
  const notes = useAll<Note>('notes');
  const wins = useAll<Win>('wins');
  const [renaming, setRenaming] = useState(false);

  if (!projects || !milestones || !phases || !notes || !wins) return <p class="muted">Loading…</p>;

  const project = projects.find((p) => p.id === props.id);
  if (!project) {
    return (
      <EmptyState title="Project not found">
        <Link href={href('projects')}>Back to Projects</Link>
      </EmptyState>
    );
  }

  const all = { milestones, notes, wins };
  const items = projectItems(project.id, all);
  const phaseById = new Map(phases.map((p) => [p.id, p]));
  const msTitle = new Map(milestones.map((m) => [m.id, m.title]));
  const phaseOrder = (m: Milestone) => phaseById.get(m.phaseId)?.order ?? 0;
  const linkedMilestones = [...items.milestones].sort((a, b) => phaseOrder(a) - phaseOrder(b) || a.order - b.order);
  const linkedNotes = [...items.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const linkedWins = [...items.wins].sort((a, b) => winSortKey(b).localeCompare(winSortKey(a)));
  const done = linkedMilestones.filter((m) => m.status === 'done').length;

  // Say why an item is here when it has no project of its own.
  const via = (r: Note | Win) => (!r.projectId && r.milestoneId ? `via ${msTitle.get(r.milestoneId)}` : null);

  const rename = async (name: string) => {
    await put('projects', { ...project, name, updatedAt: new Date().toISOString() });
    setRenaming(false);
  };

  const remove = async () => {
    const ops = deleteProjectOps(project.id, all, new Date().toISOString());
    const linked = ops.length - 1;
    const keep = linked ? ` The ${plural(linked, 'item')} linked to it will be kept, just unlinked.` : '';
    const ok = await confirmAction({
      title: 'Delete this project?',
      body: `"${project.name}" will be removed.${keep} This can't be undone (unless you restore a backup).`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await write(ops);
    await navigate(href('projects'));
  };

  return (
    <div>
      <div class="card">
        <div class="project-head">
          <h2>{project.name}</h2>
          <button type="button" class="btn btn-ghost" onClick={() => setRenaming(true)}>
            Rename
          </button>
        </div>
        {linkedMilestones.length > 0 && (
          <>
            <p class="muted small" style={{ margin: '0.25rem 0 0' }}>
              {done} of {plural(linkedMilestones.length, 'milestone')} done
            </p>
            <div
              class="progress project-progress"
              role="progressbar"
              aria-label={`${project.name} progress`}
              aria-valuemin={0}
              aria-valuemax={linkedMilestones.length}
              aria-valuenow={done}
            >
              <span style={{ width: `${(done / linkedMilestones.length) * 100}%` }} />
            </div>
          </>
        )}
      </div>

      <Section
        title="Milestones"
        count={linkedMilestones.length}
        empty="None yet. Open a milestone in Roadmap and choose this project."
      >
        {linkedMilestones.map((m) => (
          <li key={m.id}>
            <Link class="row" href={hrefFromProject('roadmap', m.id, project.id)}>
              <StatusIcon status={m.status} />
              <span class="row-main">
                <span class="row-title">{m.title}</span>
                <span class="row-sub">
                  {[STATUS_LABELS[m.status], phaseById.get(m.phaseId)?.title].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </Section>

      <Section title="Notes" count={linkedNotes.length} empty="None yet. Choose this project when editing a note.">
        {linkedNotes.map((n) => (
          <li key={n.id}>
            <Link class="row" href={hrefFromProject('notes', n.id, project.id)}>
              <span class="row-main">
                <span class="note-text">{n.text}</span>
                <span class="row-sub">{[formatDateTime(n.createdAt), via(n)].filter(Boolean).join(' · ')}</span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </Section>

      <Section title="Wins" count={linkedWins.length} empty="None yet. Choose this project when editing a win.">
        {linkedWins.map((w) => (
          <li key={w.id}>
            <Link class="row" href={hrefFromProject('wins', w.id, project.id)}>
              <span class="row-main">
                <span class="row-title">{w.title}</span>
                {winNumbers(w) && <strong>{winNumbers(w)}</strong>}
                <span class="row-sub">{[w.date ? formatDate(w.date) : null, via(w)].filter(Boolean).join(' · ')}</span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </Section>

      <button type="button" class="btn btn-ghost btn-danger-text" style={{ marginTop: '1.5rem' }} onClick={remove}>
        Delete project
      </button>

      <ProjectNameModal open={renaming} project={project} projects={projects} onClose={() => setRenaming(false)} onSave={rename} />
    </div>
  );
}
