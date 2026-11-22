import { useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import { Chevron, StatusIcon } from '../components/StatusIcon';
import { put } from '../db/db';
import { useAll, useMeta } from '../db/hooks';
import { STATUS_LABELS, type Meta, type Milestone, type Phase, type Project } from '../db/schema';
import { addMonths, formatDate, formatMonth, isISODate, monthsSince, todayISO } from '../lib/dates';
import { href } from '../router';

export function Roadmap() {
  const phases = useAll<Phase>('phases');
  const milestones = useAll<Milestone>('milestones');
  const projects = useAll<Project>('projects');
  const meta = useMeta();

  if (!phases || !milestones || !projects) return <p class="muted">Loading…</p>;

  const start = meta?.startDate;
  const elapsed = start ? monthsSince(start) : undefined;
  const projName = new Map(projects.map((p) => [p.id, p.name]));
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div>
      <StartDate meta={meta} />

      {sortedPhases.map((phase) => {
        const items = milestones.filter((m) => m.phaseId === phase.id).sort((a, b) => a.order - b.order);
        const done = items.filter((m) => m.status === 'done').length;
        const isCurrent = elapsed !== undefined && elapsed >= phase.monthsFrom && elapsed < phase.monthsTo;
        return (
          <section class="phase" key={phase.id} aria-labelledby={`ph-${phase.id}`}>
            <div class="phase-head">
              <h2 id={`ph-${phase.id}`}>
                {phase.title}
                {isCurrent && <span class="badge badge-accent">Now</span>}
              </h2>
              <span class="muted small">
                {done} of {items.length} done
              </span>
            </div>
            {start && (
              <p class="muted small phase-dates">
                {formatMonth(addMonths(start, phase.monthsFrom))} – {formatMonth(addMonths(start, phase.monthsTo))}
              </p>
            )}
            <div
              class="progress"
              role="progressbar"
              aria-label={`${phase.title} progress`}
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={done}
            >
              <span style={{ width: items.length ? `${(done / items.length) * 100}%` : '0%' }} />
            </div>

            <ul class="list">
              {items.map((m) => (
                <li key={m.id}>
                  <a class="row" href={href('roadmap', 'm', m.id)}>
                    <StatusIcon status={m.status} />
                    <span class="row-main">
                      {m.kind === 'gate' && (
                        <span class="badge badge-warn">
                          Decision gate{m.gateMonth !== undefined ? ` · month ${m.gateMonth}` : ''}
                          {start && m.gateMonth !== undefined ? ` · ${formatMonth(addMonths(start, m.gateMonth))}` : ''}
                        </span>
                      )}
                      <span class="row-title">{m.title}</span>
                      <span class="row-sub">{rowSub(m, m.projectId ? projName.get(m.projectId) : undefined)}</span>
                    </span>
                    <Chevron />
                  </a>
                </li>
              ))}
            </ul>
            <a class="btn btn-ghost add-btn" href={href('roadmap', 'new', phase.id)}>
              + Add milestone
            </a>
          </section>
        );
      })}
    </div>
  );
}

function rowSub(m: Milestone, project?: string): string {
  const parts: string[] = [STATUS_LABELS[m.status]];
  if (m.targetDate) parts.push(`Target ${formatDate(m.targetDate)}`);
  if (m.evidence.length) parts.push(`${m.evidence.length} evidence`);
  if (project) parts.push(project);
  return parts.join(' · ');
}

function StartDate(props: { meta: Meta | undefined }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const start = props.meta?.startDate;

  const openEditor = () => {
    setValue(start ?? todayISO());
    setOpen(true);
  };

  const save = async (next: string | undefined) => {
    if (!props.meta) return;
    const meta: Meta = { ...props.meta };
    if (next) meta.startDate = next;
    else delete meta.startDate;
    await put('meta', meta);
    setOpen(false);
  };

  return (
    <div class="card start-card">
      {start ? (
        <div class="start-row">
          <span>
            <span class="muted">Plan started</span> <strong>{formatDate(start)}</strong>
          </span>
          <button type="button" class="btn btn-ghost" onClick={openEditor}>
            Change
          </button>
        </div>
      ) : (
        <div>
          <p style={{ marginTop: 0 }}>Set your plan's start date to see real months for each phase and decision gate.</p>
          <button type="button" class="btn btn-primary" onClick={openEditor}>
            Set start date
          </button>
        </div>
      )}

      <Modal open={open} title="Plan start date" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isISODate(value)) save(value);
          }}
        >
          <label class="field">
            <span class="field-label">Day 1 of your plan</span>
            <input type="date" required value={value} onInput={(e) => setValue(e.currentTarget.value)} />
          </label>
          <div class="modal-actions">
            {start && (
              <button type="button" class="btn btn-ghost" onClick={() => save(undefined)}>
                Clear
              </button>
            )}
            <button type="button" class="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={!isISODate(value)}>
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
