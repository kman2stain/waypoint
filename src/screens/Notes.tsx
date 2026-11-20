import { useMemo, useState } from 'preact/hooks';
import { EmptyState } from '../components/EmptyState';
import { Link } from '../components/Link';
import { put } from '../db/db';
import { useAll } from '../db/hooks';
import type { Milestone, Note, Project } from '../db/schema';
import { formatDateTime } from '../lib/format';
import { newId } from '../lib/ids';
import { noteMatches, tagCounts } from '../lib/search';
import { extractHashtags } from '../lib/tags';
import { href } from '../router';

// Kept between visits so switching tabs never loses a half-typed note or a search.
let captureDraft = '';
let lastQuery = '';

export function Notes() {
  const notes = useAll<Note>('notes');
  const milestones = useAll<Milestone>('milestones');
  const projects = useAll<Project>('projects');

  const [text, setText] = useState(captureDraft);
  const [query, setQuery] = useState(lastQuery);
  const [savedMsg, setSavedMsg] = useState('');

  const msTitle = useMemo(() => new Map((milestones ?? []).map((m) => [m.id, m.title])), [milestones]);
  const projName = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);

  if (!notes || !milestones || !projects) return <p class="muted">Loading…</p>;

  const updateText = (v: string) => {
    captureDraft = v;
    setText(v);
    if (savedMsg) setSavedMsg('');
  };
  const updateQuery = (v: string) => {
    lastQuery = v;
    setQuery(v);
  };

  const capture = async () => {
    const t = text.trim();
    if (!t) return;
    const now = new Date().toISOString();
    const tags = extractHashtags(t);
    await put('notes', { id: newId(), text: t, tags, createdAt: now, updatedAt: now } satisfies Note);
    updateText('');
    setSavedMsg(tags.length ? `Saved with ${tags.map((x) => '#' + x).join(' ')}` : 'Saved');
  };

  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const results = sorted.filter((n) =>
    noteMatches(n, query, {
      milestoneTitle: n.milestoneId ? msTitle.get(n.milestoneId) : undefined,
      projectName: n.projectId ? projName.get(n.projectId) : undefined,
    }),
  );
  const tags = tagCounts(notes).slice(0, 12);

  return (
    <div>
      <form
        class="card capture"
        onSubmit={(e) => {
          e.preventDefault();
          capture();
        }}
      >
        <label class="visually-hidden" for="capture">
          New note
        </label>
        <textarea
          id="capture"
          rows={3}
          placeholder="Capture a thought… use #tags like #sql"
          value={text}
          onInput={(e) => updateText(e.currentTarget.value)}
        />
        <div class="capture-row">
          <span class="muted small" role="status" aria-live="polite">
            {savedMsg}
          </span>
          <button type="submit" class="btn btn-primary" disabled={!text.trim()}>
            Save note
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <EmptyState title="No notes yet">
            Capture anything as it happens: a question for your manager, a number worth checking, a study idea. Tap a
            note later to tag it or link it to a milestone.
          </EmptyState>
        </div>
      ) : (
        <>
          <div class="search">
            <label class="visually-hidden" for="note-search">
              Search notes
            </label>
            <input
              id="note-search"
              type="search"
              placeholder="Search notes or #tag"
              value={query}
              autoComplete="off"
              autoCapitalize="none"
              onInput={(e) => updateQuery(e.currentTarget.value)}
            />
          </div>

          {tags.length > 0 && (
            <div class="tag-filter" aria-label="Filter by tag">
              {tags.map(([t, n]) => {
                const active = query.trim() === `#${t}`;
                return (
                  <button
                    type="button"
                    key={t}
                    class={active ? 'chip chip-button active' : 'chip chip-button'}
                    aria-pressed={active}
                    onClick={() => updateQuery(active ? '' : `#${t}`)}
                  >
                    #{t} <span class="muted">{n}</span>
                  </button>
                );
              })}
            </div>
          )}

          <p class="muted small" aria-live="polite" style={{ margin: '0.75rem 0 0.5rem' }}>
            {query.trim() ? `${results.length} of ${notes.length} notes` : `${notes.length} notes`}
            {query.trim() && (
              <>
                {' · '}
                <button type="button" class="link-button" onClick={() => updateQuery('')}>
                  Clear search
                </button>
              </>
            )}
          </p>

          <ul class="note-list">
            {results.map((n) => (
              <li key={n.id}>
                <Link class="note-card" href={href('notes', 'n', n.id)}>
                  <span class="note-text">{n.text}</span>
                  <span class="note-meta">
                    {formatDateTime(n.createdAt)}
                    {n.milestoneId && msTitle.get(n.milestoneId) && <> · ↳ {msTitle.get(n.milestoneId)}</>}
                    {n.projectId && projName.get(n.projectId) && <> · {projName.get(n.projectId)}</>}
                  </span>
                  {n.tags.length > 0 && (
                    <span class="note-tags">
                      {n.tags.map((t) => (
                        <span key={t} class="chip chip-static">
                          #{t}
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {results.length === 0 && <p class="muted">No notes match “{query.trim()}”.</p>}
        </>
      )}
    </div>
  );
}
