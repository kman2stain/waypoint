import { useEffect, useState } from 'preact/hooks';
import { get, getAll, subscribe, type StoreName } from './db';
import type { Meta } from './schema';

// Last-known data per store, so returning to a screen renders instantly
// (and scroll position can be restored) instead of flashing "Loading".
const cache = new Map<StoreName, unknown[]>();

export function useAll<T>(store: StoreName): T[] | undefined {
  const [data, setData] = useState<T[] | undefined>(() => cache.get(store) as T[] | undefined);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getAll<T>(store).then((rows) => {
        cache.set(store, rows);
        if (alive) setData(rows);
      });
    load();
    const off = subscribe((stores) => {
      if (stores.includes(store)) load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [store]);
  return data;
}

let metaCache: Meta | undefined;

export function useMeta(): Meta | undefined {
  const [meta, setMeta] = useState<Meta | undefined>(metaCache);
  useEffect(() => {
    let alive = true;
    const load = () =>
      get<Meta>('meta', 'meta').then((m) => {
        metaCache = m;
        if (alive) setMeta(m);
      });
    load();
    const off = subscribe((stores) => {
      if (stores.includes('meta')) load();
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return meta;
}
