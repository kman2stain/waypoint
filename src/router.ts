import { useEffect, useState } from 'preact/hooks';

export const TABS = ['roadmap', 'notes', 'wins', 'reminders', 'more'] as const;
export type Tab = (typeof TABS)[number];

export interface Route {
  tab: Tab;
  /** Path segments after the tab, e.g. #/roadmap/m/abc → ['m', 'abc']. */
  params: string[];
}

export function parseHash(hash: string): Route {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  const first = parts[0] as Tab | undefined;
  if (first && (TABS as readonly string[]).includes(first)) {
    return { tab: first, params: parts.slice(1) };
  }
  return { tab: 'roadmap', params: [] };
}

export function href(tab: Tab, ...params: string[]): string {
  return '#/' + [tab, ...params].map(encodeURIComponent).join('/');
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

// ---- leave guard: lets an edit screen ask "Discard changes?" before navigating away ----
type LeaveGuard = () => boolean | Promise<boolean>;
let leaveGuard: LeaveGuard | null = null;

/** Register a guard that returns true when it's OK to leave. Returns an unregister function. */
export function setLeaveGuard(fn: LeaveGuard): () => void {
  leaveGuard = fn;
  return () => {
    if (leaveGuard === fn) leaveGuard = null;
  };
}

/** True if there are no unsaved edits, or the user agreed to discard them. */
export async function canLeave(): Promise<boolean> {
  return !leaveGuard || (await leaveGuard());
}

export async function navigate(to: string): Promise<void> {
  if (!(await canLeave())) return;
  leaveGuard = null;
  if (location.hash !== to) location.hash = to;
}
