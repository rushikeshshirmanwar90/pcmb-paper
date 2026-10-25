import { API_BASE_URL } from '@/services/apiService';

// Requests to the papers backend that need the user's login. The auth context
// hands over the token and is told when the server says the login has expired.

let token: string | null = null;
let onExpired: (() => void) | null = null;

export function setApiToken(next: string | null) {
  token = next;
}

/** Called when the server answers 401 to a signed-in request. */
export function setOnLoginExpired(handler: (() => void) | null) {
  onExpired = handler;
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
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

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
