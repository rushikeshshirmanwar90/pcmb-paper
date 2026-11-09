import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api, ApiError, setApiToken, setApiWorkspace, setOnLoginExpired } from '@/services/api-client';
import { registerForPush, setNotificationsUser, unregisterPush } from '@/services/notifications';
import { loadPreference, savePreference } from '@/services/preferences';
import { clearToken, loadToken, saveToken } from '@/services/session-store';
import { apiWorkspaceFor, resolveWorkspace, workspaceKey, workspacesFor } from '@/services/workspace';
import type { Program, Role, SchoolStandard, SchoolSubject, Track } from '@/constants/school';

/** The signed-in user, as the server describes them. */
export interface AuthUser {
  id: string;
  email: string;
  /** null until a tuition accepts them as a student or teacher. */
  role: Role | null;
  /** The workspaces this account may open; a tuition admin has Admin and Teacher. Older servers don't send it. */
  workspaces?: Role[];
  /** Proved with a code sent to it. */
  emailVerified: boolean;
  name: string;
  phone: string;
  tuition: { id: string; name: string };
  subjects: SchoolSubject[];
  /** A student's program. Older servers don't send it: use programOf(user), which falls back to the track. */
  program?: Program | null;
  track: Track | null;
  standard: SchoolStandard | null;
  batchId: string | null;
  parentPhone: string;
  /** Admin-created students must change their password on first login. */
  mustChangePassword?: boolean;
}

/** unreachable: a login is saved but the server couldn't be reached to check it. */
type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

interface AuthContextValue {
  status: AuthStatus;
  /** The signed-in user. Its `role` is the workspace in use, so every screen follows the workspace the admin switched to. */
  user: AuthUser | null;
  /** The workspaces the account may open (more than one shows the selector), and the one in use. */
  workspaces: Role[];
  workspace: Role | null;
  switchWorkspace: (next: Role) => void;
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
  // The account as the server describes it; `user` below follows the workspace in use.
  const [account, setAccount] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<Role | null>(null);

  /** Takes the account in, opening the workspace last used on this device (if it may still be opened). */
  const adopt = useCallback(async (next: AuthUser) => {
    const saved = next.role && next.tuition.id ? await loadPreference(workspaceKey(next.id, next.tuition.id)) : null;
    const open = resolveWorkspace(next.role, next.workspaces, saved);
    // Before any screen asks for data in this workspace.
    setApiWorkspace(apiWorkspaceFor(next.role, open));
    setWorkspace(open);
    setAccount(next);
  }, []);

  const forget = useCallback(async () => {
    // While the login still works: stop this phone's notifications.
    await unregisterPush().catch(() => {});
    setApiToken(null);
    setApiWorkspace(null);
    setAccount(null);
    setWorkspace(null);
    setStatus('signedOut');
    await clearToken();
  }, []);

  const keep = useCallback(async ({ token, user: next }: Session) => {
    setApiToken(token);
    await saveToken(token);
    await adopt(next);
    setStatus('signedIn');
  }, [adopt]);

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
        await adopt(me);
        if (cancelled) return;
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
  }, [forget, adopt, attempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  // Once someone is signed in on this phone, register it for notifications.
  const signedInId = status === 'signedIn' ? account?.id : null;
  useEffect(() => {
    // Class-reminder settings belong to whoever is signed in.
    setNotificationsUser(signedInId ?? null);
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
    setAccount(next);
  }, []);

  const refresh = useCallback(async () => {
    const { user: next } = await api<{ user: AuthUser }>('/auth/me');
    setAccount(next);
  }, []);

  const workspaces = useMemo(() => workspacesFor(account?.role ?? null, account?.workspaces), [account?.role, account?.workspaces]);

  const switchWorkspace = useCallback(
    (next: Role) => {
      if (!account || next === workspace || !workspaces.includes(next)) return;
      // Sent from the next request on; the server still decides what the account may do.
      setApiWorkspace(apiWorkspaceFor(account.role, next));
      setWorkspace(next);
      if (account.tuition.id) void savePreference(workspaceKey(account.id, account.tuition.id), next);
    },
    [account, workspace, workspaces]
  );

  const user = useMemo(() => (account && workspace && workspace !== account.role && workspaces.includes(workspace) ? { ...account, role: workspace } : account), [account, workspace, workspaces]);

  const value = useMemo(
    () => ({ status, user, workspaces, workspace, switchWorkspace, signIn, register, signOut: forget, changePassword, updateProfile, refresh, retry }),
    [status, user, workspaces, workspace, switchWorkspace, signIn, register, forget, changePassword, updateProfile, refresh, retry]
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
