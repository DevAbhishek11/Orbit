/**
 * HTTP client for the Orbit API.
 *
 * - Base URL is RELATIVE (`/api/v1`), so the browser only ever talks to its own
 *   origin. `vite.config.ts` proxies that to the API in dev, and any reverse
 *   proxy can do the same in prod. This avoids CORS entirely and lets the
 *   httpOnly refresh cookie ride along.
 * - Every response uses the shared envelope `{ success, data, meta }` (see
 *   `shared/src/envelope.ts`); we unwrap `data` and surface `meta.nextCursor`.
 * - A 401 triggers exactly ONE refresh attempt (single-flighted so a burst of
 *   parallel queries can't stampede the refresh endpoint), then a retry.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';


export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

// ── Access token ─────────────────────────────────────────────────────────────
// Memory only. The long-lived credential is the httpOnly refresh cookie.

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;

}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiMeta {
  requestId: string;
  nextCursor?: string | null;
  cached?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta: ApiMeta;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Idempotency-Key for safe retries on writes. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry on 401 (used by the refresh call). */
  noRetry?: boolean;
}

// ── Refresh (single-flight) ──────────────────────────────────────────────────

type AuthShape = { accessToken: string; user: unknown; workspaceId: string | null; role: string | null };

let refreshInFlight: Promise<AuthShape | null> | null = null;
let onSessionRefreshed: ((auth: AuthShape) => void) | null = null;
let onSessionLost: (() => void) | null = null;

/** The auth store registers these so a background refresh updates global state. */
export function setSessionHooks(hooks: {
  onRefreshed: (auth: AuthShape) => void;
  onLost: () => void;
}): void {
  onSessionRefreshed = hooks.onRefreshed;
  onSessionLost = hooks.onLost;
}

export function refreshSession(): Promise<AuthShape | null> {
  if (!refreshInFlight) {
    refreshInFlight = request<AuthShape>('/auth/refresh', {
      method: 'POST',
      noRetry: true,
      body: { workspaceId: localStorage.getItem('orbit.workspaceId') || undefined },
    })
      .then((auth) => {
        setAccessToken(auth.accessToken);
        onSessionRefreshed?.(auth);
        return auth;
      })
      .catch(() => {
        setAccessToken(null);
        onSessionLost?.();
        return null;
      })
      .finally(() => {
        // Release the lock on the next tick so callers awaiting this promise
        // resolve before a new refresh can start.
        queueMicrotask(() => {
          refreshInFlight = null;
        });
      });
  }
  return refreshInFlight;
}

// ── Core request ─────────────────────────────────────────────────────────────

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await requestWithMeta<T>(path, options);
  return data;
}

export async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const attempt = async (): Promise<ApiResult<T>> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;

    const response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      // Same-origin by construction, but be explicit: the refresh cookie is
      // path-scoped to /api/v1/auth and must be sent on that call.
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

    if (response.status === 204) {
      return { data: undefined as T, meta: { requestId: response.headers.get('x-request-id') ?? '-' } };
    }

    const payload = (await response.json().catch(() => null)) as
      | { success: boolean; data?: T; meta?: ApiMeta; error?: { code: string; message: string; details?: unknown; requestId?: string } }
      | null;

    if (response.ok && payload?.success) {
      return { data: payload.data as T, meta: payload.meta ?? { requestId: '-' } };
    }

    const error = payload?.error;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      error?.details,
      error?.requestId,
    );
  };

  try {
    return await attempt();
  } catch (err) {
    const isAuthFailure =
      err instanceof ApiError &&
      err.status === 401 &&
      !options.noRetry &&
      !path.startsWith('/auth/login') &&
      !path.startsWith('/auth/refresh');
    if (!isAuthFailure) throw err;

    const auth = await refreshSession();
    if (!auth) throw err;
    return attempt();
  }
}

/** Stable key for idempotent writes, so a double-click can't double-create. */
export function idempotencyKey(prefix: string): string {
  const random = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now().toString(36)}${hex}`;
}
