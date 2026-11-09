import { clearLoadCache } from '@/services/load-cache';
import { API_BASE_URL } from '@/services/apiService';
import { WORKSPACE_HEADER } from '@/services/workspace';

// Requests to the papers backend that need the user's login. The auth context
// hands over the token and is told when the server says the login has expired.

let token: string | null = null;
let onExpired: (() => void) | null = null;
let workspaceHeader: 'teacher' | null = null;

export function setApiToken(next: string | null) {
  // Another login must never start from the last one's cached answers.
  if (next !== token) clearLoadCache();
  token = next;
}

/**
 * Which workspace requests are made from: a tuition admin in the Teacher workspace sends it so the
 * server answers as for a teacher. Only a navigation choice: the server checks the account's role.
 */
export function setApiWorkspace(next: 'teacher' | null) {
  // The other workspace's answers (batches, tests) must not show in this one.
  if (next !== workspaceHeader) clearLoadCache();
  workspaceHeader = next;
}

/** Called when the server answers 401 to a signed-in request. */
export function setOnLoginExpired(handler: (() => void) | null) {
  onExpired = handler;
}

/** The login header, for requests that can't go through api() (e.g. a PDF download). */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}`, ...(workspaceHeader ? { [WORKSPACE_HEADER]: workspaceHeader } : {}) } : {};
}

/** Tells the app the login has expired, as api() does when a signed-in request gets a 401. */
export function reportLoginExpired() {
  if (token) onExpired?.();
}

/** The request failed; the message is fit for the screen. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 20000;

export async function api<T>(
  path: string,
  { method = 'GET', body, auth = true }: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(auth ? authHeaders() : {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted
        ? 'The server is taking too long. Check your internet and try again.'
        : "Couldn't reach the server. Check your internet connection."
    );
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON; handled below.
  }
  if (!res.ok) {
    const message =
      typeof (data as { error?: unknown })?.error === 'string'
        ? (data as { error: string }).error
        : `The server couldn't do that (${res.status}). Try again.`;
    if (res.status === 401 && auth && token) onExpired?.();
    throw new ApiError(res.status, message);
  }
  return data as T;
}
