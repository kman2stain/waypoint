import { useMemo, useState } from 'preact/hooks';
import { BulletText } from '../components/BulletText';
import { EmptyState } from '../components/EmptyState';
import { Link } from '../components/Link';
import { useAll } from '../db/hooks';
import type { Milestone, Project, Win } from '../db/schema';
import { copyText } from '../lib/clipboard';
import { buildCvBullet } from '../lib/cvBullet';
import { formatDate } from '../lib/dates';
import { formatNumber } from '../lib/numbers';
import { href } from '../router';

export function winSortKey(w: Win): string {
  return w.date ?? w.createdAt.slice(0, 10);
}

export function Wins() {
  const wins = useAll<Win>('wins');
  const milestones = useAll<Milestone>('milestones');
  const projects = useAll<Project>('projects');
  const [copied, setCopied] = useState<{ id: string; msg: string } | null>(null);

  const msTitle = useMemo(() => new Map((milestones ?? []).map((m) => [m.id, m.title])), [milestones]);
  const projName = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);

  if (!wins || !milestones || !projects) return <p class="muted">Loading…</p>;

  const sorted = [...wins].sort((a, b) => winSortKey(b).localeCompare(winSortKey(a)) || b.createdAt.localeCompare(a.createdAt));

  const copy = async (id: string, text: string, placeholders: number) => {
    const ok = await copyText(text);
    const msg = !ok
      ? "Couldn't copy. Press and hold the text to copy it."
      : placeholders
        ? `Copied. Fill in the ${placeholders === 1 ? 'placeholder' : `${placeholders} placeholders`} before using it.`
        : 'Copied.';
    setCopied({ id, msg });
  };

  const all = sorted.map((w) => buildCvBullet(w));
  const allText = all.map((b) => `• ${b.text}`).join('\n');
  const allPlaceholders = all.reduce((n, b) => n + b.missing.length, 0);

  return (
    <div>
      <p class="muted" style={{ marginTop: 0 }}>
        Log results as they happen, with the real numbers and who confirmed them. "Copy as CV bullet" only ever uses what
        you typed.
      </p>

      <Link class="btn btn-primary" href={href('wins', 'new')}>
        + Add win
      </Link>

      {wins.length === 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <EmptyState title="No wins yet">
            A win is any change you can point to: a report that now takes 30 minutes instead of 6 hours, fewer errors, a
            tool people use. Add it with the before and after numbers when you have them.
          </EmptyState>
        </div>
      ) : (
        <>
          <ul class="win-list">
            {sorted.map((w, i) => {
              const bullet = all[i];
              return (
                <li key={w.id} class="win-card">
                  <Link class="win-main" href={href('wins', 'w', w.id)}>
                    <span class="row-title">
                      <strong>{w.title}</strong>
                    </span>
                    <span class="win-numbers">
                      {w.before !== undefined ? formatNumber(w.before) : '?'} → {w.after !== undefined ? formatNumber(w.after) : '?'}
                      {w.unit ? ` ${w.unit}` : ''}
                    </span>
                    <span class="note-meta">
                      {[
                        w.date ? formatDate(w.date) : null,
                        w.source ? `confirmed by ${w.source}` : 'no source yet',
                        w.milestoneId ? msTitle.get(w.milestoneId) : null,
                        w.projectId ? projName.get(w.projectId) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Link>
                  <div class="win-bullet">
                    <p class="small" style={{ margin: 0 }}>
                      <BulletText text={bullet.text} />
                    </p>
                    <div class="capture-row">
                      <span class="muted small" role="status" aria-live="polite">
                        {copied?.id === w.id ? copied.msg : ''}
                      </span>
                      <button type="button" class="btn" onClick={() => copy(w.id, bullet.text, bullet.missing.length)}>
                        Copy as CV bullet
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {wins.length > 1 && (
            <div class="capture-row" style={{ marginTop: '1rem' }}>
              <span class="muted small" role="status" aria-live="polite">
                {copied?.id === 'all' ? copied.msg : ''}
              </span>
              <button type="button" class="btn" onClick={() => copy('all', allText, allPlaceholders)}>
                Copy all {wins.length} as CV bullets
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
