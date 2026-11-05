import { useState, useSyncExternalStore } from 'react';
import { useActiveTabKey } from '@/context/tab-context';
import { clearLoadCache } from '@/services/load-cache';

// A counter screens use to know the server's data changed elsewhere, e.g. a
// teacher added on the Teachers tab should show in the Home tab's totals.
// Every change bumps it; screens list it among their load dependencies.

let version = 0;
const listeners = new Set<() => void>();

export function bumpDataVersion() {
  // Cached answers predate the change; screens already open reload on their own.
  clearLoadCache();
  version += 1;
  listeners.forEach((l) => l());
}

export function useDataVersion() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => version
  );
}

/**
 * The data version for a screen in tab `tabKey`. While the tab isn't on
 * screen it keeps the version it last loaded with, so a change elsewhere
 * doesn't reload every tab at once; opening the tab catches up (one reload,
 * keeping the old data on screen meanwhile). null, or outside the role tabs:
 * always current, like useDataVersion.
 */
export function useTabDataVersion(tabKey: string | null) {
  const current = useDataVersion();
  const activeKey = useActiveTabKey();
  const active = tabKey === null || activeKey === null || activeKey === tabKey;
  const [seen, setSeen] = useState(current);
  // Caught up while on screen ("adjust state while rendering").
  if (active && seen !== current) setSeen(current);
  return active ? current : seen;
}
