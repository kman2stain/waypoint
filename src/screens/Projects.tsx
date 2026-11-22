import { useState } from 'preact/hooks';
import { EmptyState } from '../components/EmptyState';
import { Link } from '../components/Link';
import { ProjectNameModal } from '../components/ProjectNameModal';
import { Chevron } from '../components/StatusIcon';
import { put } from '../db/db';
import { useAll } from '../db/hooks';
import type { Milestone, Note, Project, Win } from '../db/schema';
import { plural } from '../lib/format';
import { newId } from '../lib/ids';
import { projectItems, type ProjectItems } from '../lib/projects';
import { href, navigate } from '../router';

function summary(items: ProjectItems): string {
  const { milestones, notes, wins } = items;
  const parts: string[] = [];
  if (milestones.length) {
    const done = milestones.filter((m) => m.status === 'done').length;
    parts.push(`${done} of ${plural(milestones.length, 'milestone')} done`);
  }
  if (notes.length) parts.push(plural(notes.length, 'note'));
  if (wins.length) parts.push(plural(wins.length, 'win'));
  return parts.join(' · ') || 'Nothing linked yet';
}

export function Projects() {
  const projects = useAll<Project>('projects');
  const milestones = useAll<Milestone>('milestones');
  const notes = useAll<Note>('notes');
  const wins = useAll<Win>('wins');
  const [adding, setAdding] = useState(false);

  if (!projects || !milestones || !notes || !wins) return <p class="muted">Loading…</p>;

  const sorted = [...projects].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));

  const add = async (name: string) => {
    const now = new Date().toISOString();
    const project: Project = { id: newId(), name, archived: false, createdAt: now, updatedAt: now };
    await put('projects', project);
    setAdding(false);
    await navigate(href('projects', 'p', project.id));
  };

  return (
    <div>
      <p class="muted" style={{ marginTop: 0 }}>
        See the milestones, notes and wins for each piece of work in one place.
      </p>
      <button type="button" class="btn btn-primary" onClick={() => setAdding(true)}>
        + Add project
      </button>

      <div style={{ marginTop: '1rem' }}>
        {sorted.length === 0 ? (
          <EmptyState title="No projects yet">
            Add one here, or choose "+ New project…" while editing a milestone, note or win.
          </EmptyState>
        ) : (
          <ul class="list">
            {sorted.map((p) => (
              <li key={p.id}>
                <Link class="row" href={href('projects', 'p', p.id)}>
                  <span class="row-main">
                    <span class="row-title">
                      <strong>{p.name}</strong>
                      {p.archived && <span class="badge badge-muted">Archived</span>}
                    </span>
                    <span class="row-sub">{summary(projectItems(p.id, { milestones, notes, wins }))}</span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProjectNameModal open={adding} projects={projects} onClose={() => setAdding(false)} onSave={add} />
    </div>
  );
}
