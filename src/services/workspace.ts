import type { Role } from '../constants/school.ts';

// Workspaces: a tuition admin's one account opens either the Admin workspace
// or the Teacher workspace. The choice only picks which screens show and is
// sent with each request; the server decides what the account may do.

export const WORKSPACE_HEADER = 'X-Workspace';

export const WORKSPACE_LABEL: Partial<Record<Role, string>> = { tuition: 'Admin', teacher: 'Teacher' };

/** Where the last workspace is remembered on this device, per user and institute. */
export const workspaceKey = (userId: string, tuitionId: string) => `pcmb.workspace.${userId}.${tuitionId}`;

/** The workspaces an account may open. Older servers don't send the list: then only its own role. */
export const workspacesFor = (role: Role | null, offered?: Role[]): Role[] => (role ? (offered?.length ? offered : [role]) : []);

/** The saved workspace if the account may still open it, else the account's own role. */
export function resolveWorkspace(role: Role | null, offered: Role[] | undefined, saved: string | null): Role | null {
  if (!role) return null;
  const allowed = workspacesFor(role, offered);
  return allowed.find((w) => w === saved) ?? role;
}

/** What requests send: only a tuition admin in the Teacher workspace has a workspace header. */
export const apiWorkspaceFor = (role: Role | null, workspace: Role | null): 'teacher' | null => (role === 'tuition' && workspace === 'teacher' ? 'teacher' : null);
