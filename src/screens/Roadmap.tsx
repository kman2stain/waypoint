import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import { Chevron, StatusIcon } from '../components/StatusIcon';
import { put } from '../db/db';
import { useAll, useMeta } from '../db/hooks';
import { STATUS_LABELS, type Meta, type Milestone, type Phase, type Project, type Win } from '../db/schema';
import { addMonths, formatDate, formatMonth, isISODate, monthsSince, todayISO } from '../lib/dates';
import { href } from '../router';

export function Roadmap() {
  const phases = useAll<Phase>('phases');
  const milestones = useAll<Milestone>('milestones');
  const projects = useAll<Project>('projects');
  const wins = useAll<Win>('wins');
  const meta = useMeta();
  const [openPhases, setOpenPhases] = useState(loadOpenPhases);
  const togglePhase = (id: string, open: boolean) => {
    const next = { ...openPhases, [id]: open };
    setOpenPhases(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: the choice lasts until the app closes */
    }
  };

  if (!phases || !milestones || !projects) return <p class="muted">Loading…</p>;

  const start = meta?.startDate;
  const elapsed = start ? monthsSince(start) : undefined;
  const projName = new Map(projects.map((p) => [p.id, p.name]));
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const currentIdx =
    elapsed === undefined ? -1 : sortedPhases.findIndex((p) => elapsed >= p.monthsFrom && elapsed < p.monthsTo);

  return (
    <div>
      <StartDate meta={meta}>
        {start && elapsed !== undefined && (
          <Overview
            start={start}
            elapsed={elapsed}
            phases={sortedPhases}
            milestones={milestones}
            wins={wins?.length ?? 0}
            projects={projects.filter((p) => !p.archived).length}
          />
        )}
      </StartDate>

      {sortedPhases.map((phase, idx) => {
        const items = milestones.filter((m) => m.phaseId === phase.id).sort((a, b) => a.order - b.order);
        const done = items.filter((m) => m.status === 'done').length;
        const isCurrent = idx === currentIdx;
        // Default view: the current phase, the next one, and earlier phases with unfinished work.
        const defaultOpen =
          currentIdx === -1 ||
          idx === currentIdx ||
          idx === currentIdx + 1 ||
          (idx < currentIdx && done < items.length);
        const open = openPhases[phase.id] ?? defaultOpen;
        return (
          <section class={`phase${isCurrent ? ' phase-current' : ''}`} key={phase.id} aria-labelledby={`ph-${phase.id}`}>
            <div class="phase-head">
              <h2>
                <button
                  type="button"
                  class="phase-toggle"
                  id={`ph-${phase.id}`}
                  aria-expanded={open}
                  aria-controls={`pl-${phase.id}`}
                  onClick={() => togglePhase(phase.id, !open)}
                >
                  <svg class="phase-chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {phase.title}
                </button>
                {isCurrent && <span class="badge badge-accent">Now</span>}
              </h2>
              <span class={`phase-count${done === items.length && items.length ? ' phase-count-done' : ''}`}>
                {done}/{items.length}
              </span>
            </div>
            {start && (
              <p class="muted small phase-dates">
                {formatMonth(addMonths(start, phase.monthsFrom))} – {formatMonth(addMonths(start, phase.monthsTo))}
                {!open && items.length > 0 && ` · ${items.length} milestone${items.length === 1 ? '' : 's'}`}
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

            {open && (
              <div id={`pl-${phase.id}`}>
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
                          <span class={`row-title${m.status === 'done' ? ' row-title-done' : ''}`}>{m.title}</span>
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
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---- which phases are expanded: remembered on this device only
const OPEN_KEY = 'waypoint.ui.openPhases';

function loadOpenPhases(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function Overview(props: {
  start: string;
  elapsed: number;
  phases: Phase[];
  milestones: Milestone[];
  wins: number;
  projects: number;
}) {
  const { start, elapsed, phases, milestones } = props;
  const total = milestones.length;
  const done = milestones.filter((m) => m.status === 'done').length;
  const active = milestones.filter((m) => m.status === 'in_progress').length;
  const planMonths = Math.max(0, ...phases.map((p) => p.monthsTo));
  const nextGate = milestones
    .filter((m) => m.kind === 'gate' && m.status !== 'done' && m.gateMonth !== undefined)
    .sort((a, b) => a.gateMonth! - b.gateMonth!)[0];

  let when: string;
  if (elapsed < 0) when = `Starts ${formatDate(start)}`;
  else if (elapsed >= planMonths) when = 'Plan period complete';
  else when = `Month ${elapsed + 1} of ${planMonths}`;

  return (
    <div class="overview">
      <span class="overview-when">{when}</span>

      {(props.wins > 0 || props.projects > 0) && (
        <a class="overview-delivered" href={href('wins')}>
          <span class="overview-delivered-label">Delivered so far</span>
          <span class="overview-delivered-nums">
            <span>
              <strong>{props.wins}</strong> win{props.wins === 1 ? '' : 's'}
            </span>
            <span>
              <strong>{props.projects}</strong> project{props.projects === 1 ? '' : 's'}
            </span>
          </span>
          <Chevron />
        </a>
      )}

      <div class="overview-plan-head">
        <span class="muted small">Plan milestones</span>
        <span class="muted small">
          {done} of {total} done
        </span>
      </div>
      <div
        class="progress progress-lg"
        role="progressbar"
        aria-label="Plan milestones done"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} done, ${active} in progress`}
      >
        <span style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
        <span class="progress-partial" style={{ width: total ? `${(active / total) * 100}%` : '0%' }} />
      </div>
      <dl class="overview-stats">
        <div>
          <dt>Done</dt>
          <dd>{done}</dd>
        </div>
        <div>
          <dt>In progress</dt>
          <dd>{active}</dd>
        </div>
        <div>
          <dt>To do</dt>
          <dd>{total - done - active}</dd>
        </div>
      </dl>
      {nextGate && (
        <a class="overview-gate" href={href('roadmap', 'm', nextGate.id)}>
          <span class="badge badge-warn">Next decision gate</span>
          <span class="overview-gate-when">
            {formatMonth(addMonths(start, nextGate.gateMonth!))} ·{' '}
            {gateCountdown(nextGate.gateMonth! - Math.max(elapsed, 0))}
          </span>
        </a>
      )}
    </div>
  );
}

function gateCountdown(months: number): string {
  if (months <= 0) return 'due now';
  return `in ${months} month${months === 1 ? '' : 's'}`;
}

function rowSub(m: Milestone, project?: string): string {
  const parts: string[] = [STATUS_LABELS[m.status]];
  if (m.targetDate) parts.push(`Target ${formatDate(m.targetDate)}`);
  if (m.evidence.length) parts.push(`${m.evidence.length} evidence`);
  if (project) parts.push(project);
  return parts.join(' · ');
}

function StartDate(props: { meta: Meta | undefined; children?: ComponentChildren }) {
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
        <>
          {props.children}
          <div class="start-row">
            <span class="muted small">
              Plan started <strong>{formatDate(start)}</strong>
            </span>
            <button type="button" class="link-button small" onClick={openEditor}>
              Change
            </button>
          </div>
        </>
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
