import { useMemo, useState } from 'preact/hooks';
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
    setTimeout(() => setCopied((c) => (c?.id === id && c.msg === msg ? null : c)), placeholders ? 6000 : 2500);
  };

  const all = sorted.map((w) => buildCvBullet(w));
  const allText = all.map((b) => `• ${b.text}`).join('\n');
  const allPlaceholders = all.reduce((n, b) => n + b.missing.length, 0);

  return (
    <div>
      <p class="muted" style={{ marginTop: 0 }}>
        Log results as they happen, with the real numbers and who confirmed them. CV bullets only ever use what you
        typed.
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
              const hasNumbers = w.before !== undefined || w.after !== undefined;
              const where = [w.projectId ? projName.get(w.projectId) : null, w.milestoneId ? msTitle.get(w.milestoneId) : null]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={w.id} class="win-card">
                  <Link class="win-main" href={href('wins', 'w', w.id)}>
                    <span class="win-top">
                      <strong class="win-title">{w.title}</strong>
                      {w.date && <span class="win-date">{formatDate(w.date)}</span>}
                    </span>
                    {hasNumbers && (
                      <span class="win-numbers">
                        {w.before !== undefined ? formatNumber(w.before) : '?'}
                        <span aria-label="to"> → </span>
                        {w.after !== undefined ? formatNumber(w.after) : '?'}
                        {w.unit ? <span class="win-unit"> {w.unit}</span> : null}
                      </span>
                    )}
                    {where && <span class="win-where">{where}</span>}
                  </Link>
                  <div class="win-foot">
                    {w.source ? (
                      <span class="win-source">
                        <CheckIcon />
                        <span class="win-source-text">{w.source}</span>
                      </span>
                    ) : (
                      <span class="win-source win-source-missing">No source yet</span>
                    )}
                    <button
                      type="button"
                      class="btn btn-ghost btn-small"
                      onClick={() => copy(w.id, bullet.text, bullet.missing.length)}
                    >
                      {copied?.id === w.id ? 'Copied' : 'Copy CV bullet'}
                    </button>
                  </div>
                  {copied?.id === w.id && copied.msg !== 'Copied.' && (
                    <p class="muted small win-copy-msg" role="status">
                      {copied.msg}
                    </p>
                  )}
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" class="win-check">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
