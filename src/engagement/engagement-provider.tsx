import React, { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useSignedInUser } from '@/context/auth-context';
import { engagementStore, type EngagementState } from '@/engagement/engagement-store';
import { ApiError } from '@/services/api-client';
import { engagementApi } from '@/services/engagement-api';

// Student login only. Loads the student's progress once, then keeps it current
// from learning responses (no refetch). Reloads on pull-to-refresh and when the
// app comes back to the foreground. Teacher and tuition logins never mount it.

/** Returning to the app reloads at most this often. */
const FOREGROUND_RELOAD_MS = 30_000;

const ReloadContext = createContext<(() => void) | null>(null);

export function EngagementProvider({ children }: PropsWithChildren) {
  const user = useSignedInUser();
  const lastLoad = useRef(0);

  const reload = useCallback(() => {
    lastLoad.current = Date.now();
    const token = engagementStore.beginLoad();
    engagementApi.me().then(
      (res) => engagementStore.finishLoad(token, res),
      (e: unknown) => {
        const offline = e instanceof ApiError && e.status === 0;
        engagementStore.failLoad(token, offline ? "You're offline." : e instanceof Error ? e.message : "Couldn't load your progress.", offline);
      }
    );
  }, []);

  useEffect(() => {
    engagementStore.reset(user.id);
    reload();
  }, [user.id, reload]);

  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const back = next === 'active' && previous !== 'active';
      previous = next;
      if (back && Date.now() - lastLoad.current > FOREGROUND_RELOAD_MS) reload();
    });
    return () => sub.remove();
  }, [reload]);

  return <ReloadContext.Provider value={reload}>{children}</ReloadContext.Provider>;
}

/** The student's progress as last reported by the server, and a way to reload it. */
export function useEngagement(): EngagementState & { reload: () => void } {
  const state = useSyncExternalStore(engagementStore.subscribe, engagementStore.get);
  const reload = useContext(ReloadContext);
  return { ...state, reload: reload ?? noop };
}

const noop = () => {};
