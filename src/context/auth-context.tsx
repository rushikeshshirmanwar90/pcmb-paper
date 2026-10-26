import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api, ApiError, setApiToken, setOnLoginExpired } from '@/services/api-client';
import { registerForPush, unregisterPush } from '@/services/notifications';
import { clearToken, loadToken, saveToken } from '@/services/session-store';
import type { Role, SchoolStandard, SchoolSubject, Track } from '@/constants/school';

/** The signed-in user, as the server describes them. */
export interface AuthUser {
  id: string;
  email: string;
  /** null until a tuition accepts them as a student or teacher. */
  role: Role | null;
  /** Proved with a code sent to it. */
  emailVerified: boolean;
  name: string;
  phone: string;
  tuition: { id: string; name: string };
  subjects: SchoolSubject[];
  track: Track | null;
  standard: SchoolStandard | null;
  batchId: string | null;
  parentPhone: string;
}

/** unreachable: a login is saved but the server couldn't be reached to check it. */
type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates an account (no tuition yet) and logs in. */
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (changes: Partial<Pick<AuthUser, 'name' | 'phone' | 'parentPhone'>>) => Promise<void>;
  /** Reloads the user, e.g. after the tuition changed their batch. */
  refresh: () => Promise<void>;
  /** Tries the saved login again after the server couldn't be reached. */
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type Session = { token: string; user: AuthUser };

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const forget = useCallback(async () => {
    // While the login still works: stop this phone's notifications.
    await unregisterPush().catch(() => {});
    setApiToken(null);
    setUser(null);
    setStatus('signedOut');
    await clearToken();
  }, []);

  const keep = useCallback(async ({ token, user: next }: Session) => {
    setApiToken(token);
    await saveToken(token);
    setUser(next);
    setStatus('signedIn');
  }, []);

  // On launch (and on retry): is there a saved login, and is it still good?
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadToken();
      if (!saved) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      setApiToken(saved);
      try {
        const { user: me } = await api<{ user: AuthUser }>('/auth/me');
        if (cancelled) return;
        setUser(me);
        setStatus('signedIn');
      } catch (error) {
        if (cancelled) return;
        // Offline or the server is down: keep the login and offer a retry.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) await forget();
        else setStatus('unreachable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forget, attempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  // Once someone is signed in on this phone, register it for notifications.
  const signedInId = status === 'signedIn' ? user?.id : null;
  useEffect(() => {
    if (signedInId) void registerForPush();
  }, [signedInId]);

  useEffect(() => {
    setOnLoginExpired(() => void forget());
    return () => setOnLoginExpired(null);
  }, [forget]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await keep(await api<Session>('/auth/login', { method: 'POST', body: { email, password }, auth: false }));
    },
    [keep]
  );

  const register = useCallback(
    async (input: { name: string; email: string; phone: string; password: string }) => {
      await keep(await api<Session>('/auth/register', { method: 'POST', body: input, auth: false }));
    },
    [keep]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await keep(await api<Session>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }));
    },
    [keep]
  );

  const updateProfile = useCallback(async (changes: Partial<Pick<AuthUser, 'name' | 'phone' | 'parentPhone'>>) => {
    const { user: next } = await api<{ user: AuthUser }>('/auth/me', { method: 'PATCH', body: changes });
    setUser(next);
  }, []);

  const refresh = useCallback(async () => {
    const { user: next } = await api<{ user: AuthUser }>('/auth/me');
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, register, signOut: forget, changePassword, updateProfile, refresh, retry }),
    [status, user, signIn, register, forget, changePassword, updateProfile, refresh, retry]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/** The signed-in user; only for screens shown after login. */
export function useSignedInUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useSignedInUser needs a signed-in user');
  return user;
}
