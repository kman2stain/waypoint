// What belongs to a project, and how to take a project away safely.
import type { WriteOp } from '../db/db';
import type { Milestone, Note, Project, Win } from '../db/schema';

export interface ProjectItems {
  milestones: Milestone[];
  notes: Note[];
  wins: Win[];
}

/**
 * Milestones linked to the project, plus notes and wins linked either directly or
 * through one of those milestones. A note's or win's own project always takes priority.
 */
export function projectItems(id: string, all: ProjectItems): ProjectItems {
  const milestones = all.milestones.filter((m) => m.projectId === id);
  const milestoneIds = new Set(milestones.map((m) => m.id));
  const belongs = (r: Note | Win) =>
    r.projectId ? r.projectId === id : !!r.milestoneId && milestoneIds.has(r.milestoneId);
  return { milestones, notes: all.notes.filter(belongs), wins: all.wins.filter(belongs) };
}

export function findProjectByName(name: string, projects: Project[]): Project | undefined {
  const wanted = name.trim().toLowerCase();
  return projects.find((p) => p.name.trim().toLowerCase() === wanted);
}

/** Deletes the project and unlinks whatever pointed at it. Nothing else is deleted. */
export function deleteProjectOps(id: string, all: ProjectItems, now: string): WriteOp[] {
  const ops: WriteOp[] = [{ type: 'delete', store: 'projects', key: id }];
  for (const store of ['milestones', 'notes', 'wins'] as const) {
    for (const record of all[store]) {
      if (record.projectId !== id) continue;
      const { projectId: _unlinked, ...rest } = record;
      const unlinked = { ...rest, updatedAt: now };
      ops.push({ type: 'put', store, value: unlinked });
    }
  }
  return ops;
}
