const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";

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
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

let accessToken: string | null = null;

const SESSION_CHANNEL = "orbit.session";
type SessionMessage =
  | { type: "token"; accessToken: string; at: number }
  | { type: "signed-out"; at: number }
  | { type: "signed-in"; at: number };

const sessionChannel: BroadcastChannel | null =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(SESSION_CHANNEL);

let onForeignToken: ((token: string) => void) | null = null;
let onForeignSignOut: (() => void) | null = null;
let onForeignSignIn: (() => void) | null = null;

sessionChannel?.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as SessionMessage | null;
  if (!message) return;
  if (message.type === "token") {
    accessToken = message.accessToken;
    onForeignToken?.(message.accessToken);
  } else if (message.type === "signed-out") {
    accessToken = null;
    onForeignSignOut?.();
  } else if (message.type === "signed-in") {
    onForeignSignIn?.();
  }
});

export function setCrossTabHooks(hooks: {
  onToken?: (token: string) => void;
  onSignOut?: () => void;
  onSignIn?: () => void;
}): void {
  onForeignToken = hooks.onToken ?? null;
  onForeignSignOut = hooks.onSignOut ?? null;
  onForeignSignIn = hooks.onSignIn ?? null;
}

export function broadcastSession(message: SessionMessage): void {
  sessionChannel?.postMessage(message);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

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
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;

  idempotencyKey?: string;
  signal?: AbortSignal;

  noRetry?: boolean;
}

type AuthShape = {
  accessToken: string;
  user: unknown;
  workspaceId: string | null;
  role: string | null;
};

let refreshInFlight: Promise<AuthShape | null> | null = null;
let onSessionRefreshed: ((auth: AuthShape) => void) | null = null;
let onSessionLost: (() => void) | null = null;

export function setSessionHooks(hooks: {
  onRefreshed: (auth: AuthShape) => void;
  onLost: () => void;
}): void {
  onSessionRefreshed = hooks.onRefreshed;
  onSessionLost = hooks.onLost;
}

const REFRESH_LOCK_KEY = "orbit.refreshLock";
const REFRESH_LOCK_TTL_MS = 8_000;

function acquireRefreshLock(): boolean {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const held = Number(raw);
      if (Number.isFinite(held) && now - held < REFRESH_LOCK_TTL_MS)
        return false;
    }
    localStorage.setItem(REFRESH_LOCK_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

function releaseRefreshLock(): void {
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    void 0;
  }
}

function waitForForeignToken(
  timeoutMs = REFRESH_LOCK_TTL_MS,
): Promise<string | null> {
  if (!sessionChannel) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sessionChannel.removeEventListener("message", listener);
      resolve(null);
    }, timeoutMs);
    const listener = (event: MessageEvent) => {
      const message = event.data as SessionMessage | null;
      if (message?.type === "token") {
        clearTimeout(timer);
        sessionChannel.removeEventListener("message", listener);
        resolve(message.accessToken);
      }
      if (message?.type === "signed-out") {
        clearTimeout(timer);
        sessionChannel.removeEventListener("message", listener);
        resolve(null);
      }
    };
    sessionChannel.addEventListener("message", listener);
  });
}

export function refreshSession(): Promise<AuthShape | null> {
  if (!refreshInFlight) {
    refreshInFlight = runRefresh().finally(() => {
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    });
  }
  return refreshInFlight;
}

async function runRefresh(): Promise<AuthShape | null> {
  if (!acquireRefreshLock()) {
    const token = await waitForForeignToken();
    if (token) {
      setAccessToken(token);
      return null;
    }
  }

  try {
    return await request<AuthShape>("/auth/refresh", {
      method: "POST",
      noRetry: true,
      body: {
        workspaceId: localStorage.getItem("orbit.workspaceId") || undefined,
      },
    })
      .then((auth) => {
        setAccessToken(auth.accessToken);
        broadcastSession({
          type: "token",
          accessToken: auth.accessToken,
          at: Date.now(),
        });
        onSessionRefreshed?.(auth);
        return auth;
      })
      .catch(() => {
        setAccessToken(null);
        broadcastSession({ type: "signed-out", at: Date.now() });
        onSessionLost?.();
        return null;
      });
  } finally {
    releaseRefreshLock();
  }
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { data } = await requestWithMeta<T>(path, options);
  return data;
}

export async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const attempt = async (): Promise<ApiResult<T>> => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body !== undefined)
      headers["content-type"] = "application/json";
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    if (options.idempotencyKey)
      headers["idempotency-key"] = options.idempotencyKey;

    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), {
        method: options.method ?? "GET",
        headers,

        credentials: "include",
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (networkErr: unknown) {
      if (options.signal?.aborted) {
        throw networkErr;
      }
      const isMutation =
        options.method &&
        ["POST", "PATCH", "PUT", "DELETE"].includes(options.method);
      if (isMutation && typeof navigator !== "undefined" && !navigator.onLine) {
        try {
          const { enqueueOutbox } = await import("../lib/offline-db");
          await enqueueOutbox({
            url: buildUrl(path, options.query),
            method: options.method ?? "GET",
            body:
              options.body === undefined ? "" : JSON.stringify(options.body),
            headers: headers as Record<string, string>,
          });
          throw new ApiError(
            "OFFLINE_QUEUED",
            "You are offline — this change has been queued and will sync when back online.",
            0,
            { queued: true },
          );
        } catch (e) {
          if (e instanceof ApiError && e.code === "OFFLINE_QUEUED") throw e;
        }
      }
      const msg =
        networkErr instanceof Error ? networkErr.message : "Network error";
      throw new ApiError(
        "NETWORK_ERROR",
        `Unable to reach server (${msg}). Check your connection or verify backend at /status.`,
        0,
        { originalError: msg },
      );
    }

    if (response.status === 204) {
      return {
        data: undefined as T,
        meta: { requestId: response.headers.get("x-request-id") ?? "-" },
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      success: boolean;
      data?: T;
      meta?: ApiMeta;
      error?: {
        code: string;
        message: string;
        details?: unknown;
        requestId?: string;
      };
    } | null;

    if (response.ok && payload?.success) {
      return {
        data: payload.data as T,
        meta: payload.meta ?? { requestId: "-" },
      };
    }

    const error = payload?.error;
    throw new ApiError(
      error?.code ?? "INTERNAL_ERROR",
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
      !path.startsWith("/auth/login") &&
      !path.startsWith("/auth/refresh");
    if (!isAuthFailure) throw err;

    const auth = await refreshSession();
    if (!auth) throw err;
    return attempt();
  }
}

export function idempotencyKey(prefix: string): string {
  const random = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${prefix}_${Date.now().toString(36)}${hex}`;
}

export async function requestBinary<T>(
  path: string,
  body: Blob,
  contentType: string,
): Promise<T> {
  const attempt = async (): Promise<T> => {
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": contentType,
    };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    const response = await fetch(buildUrl(path), {
      method: "POST",
      headers,
      credentials: "include",
      body,
    });
    const payload = (await response.json().catch(() => null)) as {
      success: boolean;
      data?: T;
      error?: { code: string; message: string; details?: unknown };
    } | null;
    if (response.ok && payload?.success) return payload.data as T;
    throw new ApiError(
      payload?.error?.code ?? "INTERNAL_ERROR",
      payload?.error?.message ?? `Upload failed with status ${response.status}`,
      response.status,
      payload?.error?.details,
    );
  };

  try {
    return await attempt();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const auth = await refreshSession();
    if (!auth) throw err;
    return attempt();
  }
}

export async function fetchBlob(path: string): Promise<Blob> {
  const attempt = async (): Promise<Response> =>
    fetch(buildUrl(path), {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      credentials: "include",
    });

  let response = await attempt();
  if (response.status === 401) {
    const auth = await refreshSession();
    if (auth) response = await attempt();
  }
  if (!response.ok) {
    throw new ApiError(
      "INTERNAL_ERROR",
      `Could not load file (${response.status})`,
      response.status,
    );
  }
  return response.blob();
}
