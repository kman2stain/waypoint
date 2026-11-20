import type { FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { MoreIcon, NotesIcon, RemindersIcon, RoadmapIcon, WinsIcon } from './components/Icons';
import { UpdateToast } from './components/UpdateToast';
import { requestPersistentStorage } from './lib/device';
import { href, type Tab, useRoute } from './router';
import { More } from './screens/More';
import { Placeholder } from './screens/Placeholder';

const NAV: { tab: Tab; label: string; Icon: FunctionComponent }[] = [
  { tab: 'roadmap', label: 'Roadmap', Icon: RoadmapIcon },
  { tab: 'notes', label: 'Notes', Icon: NotesIcon },
  { tab: 'wins', label: 'Wins', Icon: WinsIcon },
  { tab: 'reminders', label: 'Reminders', Icon: RemindersIcon },
  { tab: 'more', label: 'More', Icon: MoreIcon },
];

const STORAGE_LABELS = { persistent: 'Persistent', 'best-effort': 'Best effort', unknown: 'Unknown' } as const;

export function App() {
  const route = useRoute();
  const current = NAV.find((n) => n.tab === route.tab)!;
  const [storage, setStorage] = useState('Checking…');

  useEffect(() => {
    requestPersistentStorage().then((s) => setStorage(STORAGE_LABELS[s]));
  }, []);

  useEffect(() => {
    document.title = `${current.label} · Waypoint`;
    window.scrollTo(0, 0);
  }, [current.label]);

  return (
    <div class="app">
      <header class="topbar">
        <h1>{current.label}</h1>
      </header>

      <main class="content" id="main">
        {route.tab === 'more' ? <More storage={storage} /> : <Placeholder which={route.tab} />}
      </main>

      <nav class="tabbar" aria-label="Main">
        {NAV.map(({ tab, label, Icon }) => (
          <a key={tab} class="tab" href={href(tab)} aria-current={tab === route.tab ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <UpdateToast />
    </div>
  );
}
