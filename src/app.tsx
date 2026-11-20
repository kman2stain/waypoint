import type { FunctionComponent } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { MoreIcon, NotesIcon, RemindersIcon, RoadmapIcon, WinsIcon } from './components/Icons';
import { UpdateToast } from './components/UpdateToast';
import { ensureSeeded } from './db/seed';
import { requestPersistentStorage } from './lib/device';
import { href, navigate, type Route, type Tab, useRoute } from './router';
import { MilestoneDetail } from './screens/MilestoneDetail';
import { REMINDER_KINDS, type Reminder } from './db/schema';
import { More } from './screens/More';
import { ReminderDetail } from './screens/ReminderDetail';
import { Reminders } from './screens/Reminders';
import { NoteDetail, noteBackHref } from './screens/NoteDetail';
import { Notes } from './screens/Notes';
import { Placeholder } from './screens/Placeholder';
import { Roadmap } from './screens/Roadmap';

const NAV: { tab: Tab; label: string; Icon: FunctionComponent }[] = [
  { tab: 'roadmap', label: 'Roadmap', Icon: RoadmapIcon },
  { tab: 'notes', label: 'Notes', Icon: NotesIcon },
  { tab: 'reminders', label: 'Reminders', Icon: RemindersIcon },
  { tab: 'wins', label: 'Wins', Icon: WinsIcon },
  { tab: 'more', label: 'More', Icon: MoreIcon },
];

const STORAGE_LABELS = { persistent: 'Persistent', 'best-effort': 'Best effort', unknown: 'Unknown' } as const;

/** Sub-screen title + back target, or null for a tab's root screen. */
function subScreen(route: Route): { title: string; back: string; backLabel?: string } | null {
  const [kind, id] = route.params;
  if (route.tab === 'roadmap' && kind === 'm') return { title: 'Milestone', back: href('roadmap') };
  if (route.tab === 'roadmap' && kind === 'new') return { title: 'New milestone', back: href('roadmap') };
  if (route.tab === 'reminders' && kind === 'r') return { title: 'Reminder', back: href('reminders') };
  if (route.tab === 'reminders' && kind === 'new') return { title: 'New reminder', back: href('reminders') };
  if (route.tab === 'notes' && kind === 'n') return { title: 'Note', back: href('notes') };
  if (route.tab === 'notes' && kind === 'new') {
    return { title: 'New note', back: noteBackHref(id), backLabel: id ? 'Milestone' : undefined };
  }
  return null;
}

function Screen(props: { route: Route; storage: string }) {
  const { tab, params } = props.route;
  switch (tab) {
    case 'roadmap':
      if (params[0] === 'm' && params[1]) return <MilestoneDetail key={params[1]} id={params[1]} />;
      if (params[0] === 'new' && params[1]) return <MilestoneDetail key={`new-${params[1]}`} newInPhase={params[1]} />;
      return <Roadmap />;
    case 'notes':
      if (params[0] === 'n' && params[1]) return <NoteDetail key={params[1]} id={params[1]} />;
      if (params[0] === 'new') return <NoteDetail key={`new-${params[1] ?? ''}`} isNew forMilestone={params[1]} />;
      return <Notes />;
    case 'reminders':
      if (params[0] === 'r' && params[1]) return <ReminderDetail key={params[1]} id={params[1]} />;
      if (params[0] === 'new' && (REMINDER_KINDS as readonly string[]).includes(params[1] ?? '')) {
        return <ReminderDetail key={`new-${params[1]}`} newKind={params[1] as Reminder['kind']} />;
      }
      return <Reminders />;
    case 'more':
      return <More storage={props.storage} />;
    default:
      return <Placeholder which={tab} />;
  }
}

// Remember scroll position per screen so going back lands where you were.
const scrollPositions = new Map<string, number>();

export function App() {
  const route = useRoute();
  const current = NAV.find((n) => n.tab === route.tab)!;
  const sub = subScreen(route);
  const [storage, setStorage] = useState('Checking…');
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    requestPersistentStorage().then((s) => setStorage(STORAGE_LABELS[s]));
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e: unknown) => setDbError(e instanceof Error ? e.message : String(e)));
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  const title = sub?.title ?? current.label;
  useEffect(() => {
    document.title = `${title} · Waypoint`;
  }, [title]);

  const key = location.hash || '#/roadmap';
  const keyRef = useRef(key);
  useLayoutEffect(() => {
    keyRef.current = key;
    window.scrollTo(0, scrollPositions.get(key) ?? 0);
  }, [key, ready]);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => scrollPositions.set(keyRef.current, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (e: MouseEvent, to: string) => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <div class="app">
      <header class="topbar">
        {sub && (
          <a class="back" href={sub.back} onClick={(e) => go(e, sub.back)}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {sub.backLabel ?? current.label}
          </a>
        )}
        <h1>{title}</h1>
      </header>

      <main class="content" id="main">
        {dbError ? (
          <div class="card" role="alert">
            <h2 style={{ fontSize: '1.1rem' }}>Storage isn't available</h2>
            <p class="muted">{dbError}</p>
            <p class="muted" style={{ marginBottom: 0 }}>
              Private Browsing blocks storage. Open Waypoint from its home-screen icon, or in a normal Safari tab.
            </p>
          </div>
        ) : ready ? (
          <Screen route={route} storage={storage} />
        ) : (
          <p class="muted">Loading…</p>
        )}
      </main>

      <nav class="tabbar" aria-label="Main">
        {NAV.map(({ tab, label, Icon }) => (
          <a
            key={tab}
            class="tab"
            href={href(tab)}
            aria-current={tab === route.tab ? 'page' : undefined}
            onClick={(e) => go(e, href(tab))}
          >
            <Icon />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <UpdateToast />
    </div>
  );
}
