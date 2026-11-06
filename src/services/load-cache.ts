// The last answer to each GET a screen loads with `useLoad({ cacheKey })`, kept
// in memory so opening a screen again shows its data at once while the fresh
// answer loads. Requests that are already under way are shared, so two screens
// asking for the same thing at the same time make one call.
//
// Nothing here outlives the app, and it empties itself whenever the data
// changes (bumpDataVersion) or the login does (setApiToken), so a screen never
// starts from what was there before an edit or from another user's data.

const MAX_ENTRIES = 60;

const entries = new Map<string, unknown>();
/** The request each key is waiting on. Only that one may store its answer, so a request that was cleared or replaced while under way never does. */
const inflight = new Map<string, Promise<unknown>>();

export const cachedLoad = <T>(key: string): T | undefined => entries.get(key) as T | undefined;

function remember(key: string, data: unknown) {
  entries.delete(key);
  entries.set(key, data);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
}

/**
 * Runs `load` and keeps its answer under `key`, unless a request for `key` is
 * already under way: then that one is shared. `fresh` (a refresh or retry the
 * user asked for) always sends a new request, so it can't end up waiting on
 * one that has stalled.
 */
export function loadShared<T>(key: string, load: () => Promise<T>, { fresh = false }: { fresh?: boolean } = {}): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running && !fresh) return running;
  const request: Promise<T> = load()
    .then((data) => {
      if (inflight.get(key) === request) remember(key, data);
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

export function clearLoadCache() {
  entries.clear();
  inflight.clear();
}
