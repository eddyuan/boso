import { Platform } from 'react-native';

import { API_URL, authClient, refreshSession } from '@/lib/auth-client';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

// fetch() wrapper for apps/web API routes. On native, the session cookie lives
// in SecureStore and has to be attached manually; on web the browser sends it.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (Platform.OS !== 'web') {
    const cookie = await authClient.getCookie();
    if (cookie) headers.set('Cookie', cookie);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });

  if (res.status === 401 || res.status === 403) {
    // Revoked/expired session, or contact no longer verified — refresh local
    // session state so the root layout routes to the right screen.
    refreshSession();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = typeof body.error === 'string' ? body.error : undefined;
    throw new ApiError(res.status, code, code ?? `${init.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
