// Shared "link to a milestone / project" fields for Notes and Wins.
import type { WriteOp } from '../db/db';
import type { Milestone, Phase, Project } from '../db/schema';
import { newId } from '../lib/ids';

export const NEW_PROJECT = '__new__';

export function MilestoneSelect(props: { value: string; phases: Phase[]; milestones: Milestone[]; onChange: (id: string) => void }) {
  const sortedPhases = [...props.phases].sort((a, b) => a.order - b.order);
  return (
    <label class="field">
      <span class="field-label">
        Milestone <span class="muted">(optional)</span>
      </span>
      <select value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
        <option value="">None</option>
        {sortedPhases.map((p) => (
          <optgroup key={p.id} label={p.title}>
            {props.milestones
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
  );
}

export function ProjectSelect(props: {
  id: string;
  value: string;
  newName: string;
  projects: Project[];
  onChange: (id: string) => void;
  onNewName: (name: string) => void;
}) {
  const active = props.projects.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div class="field">
      <label class="field-label" for={props.id}>
        Project <span class="muted">(optional)</span>
      </label>
      <select id={props.id} value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
        <option value="">None</option>
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value={NEW_PROJECT}>+ New project…</option>
      </select>
      {props.value === NEW_PROJECT && (
        <input
          type="text"
          style={{ marginTop: '0.5rem' }}
          placeholder="Project name, e.g. PR app"
          aria-label="New project name"
          value={props.newName}
          onInput={(e) => props.onNewName(e.currentTarget.value)}
        />
      )}
    </div>
  );
}

/** True when the project choice is complete (a new project needs a name). */
export function projectChoiceValid(value: string, newName: string): boolean {
  return value !== NEW_PROJECT || newName.trim().length > 0;
}

/**
 * Turns the project choice into an id, creating the project if needed.
 * Reuses an existing project with the same name instead of duplicating it.
 */
export function resolveProject(
  value: string,
  newName: string,
  projects: Project[],
  now: string,
): { projectId?: string; ops: WriteOp[] } {
  if (value !== NEW_PROJECT) return { projectId: value || undefined, ops: [] };
  const name = newName.trim();
  const same = projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (same) return { projectId: same.id, ops: [] };
  const project: Project = { id: newId(), name, archived: false, createdAt: now, updatedAt: now };
  return { projectId: project.id, ops: [{ type: 'put', store: 'projects', value: project }] };
}
