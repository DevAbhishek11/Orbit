/**
 * Typed error taxonomy (BUILD_PROMPT rule 21).
 * Every thrown error in the API is an ApiError carrying a code from the
 * shared catalogue — never a bare Error, never matched on message strings.
 */
import { ErrorCodeStatus, type ErrorCode } from '@orbit/shared';

export interface ApiErrorOptions {
  /** Extra machine-readable details (e.g. zod issues, current doc on 409). */
  details?: Record<string, unknown>;
  /** Override the catalogue status (rare; keep codes canonical). */
  status?: number;
  /** Root cause for logs — never sent to the client. */
  cause?: unknown;
  /** Extra headers (e.g. Retry-After on 429). */
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly headers?: Record<string, string>;
  /** True when this error is an expected, client-facing outcome (4xx). */
  readonly expected: boolean;

  constructor(code: ErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = options.status ?? ErrorCodeStatus[code];
    this.details = options.details;
    this.headers = options.headers;
    this.expected = this.status >= 400 && this.status < 500;
    Error.captureStackTrace?.(this, ApiError);
  }
}

// ── Convenience factories (used across modules & tests) ──────────────

export const badRequest = (message = 'Malformed request', details?: Record<string, unknown>) =>
  new ApiError('VALIDATION_ERROR', message, { details, status: 400 });

export const validationFailed = (issues: unknown[]) =>
  new ApiError('VALIDATION_ERROR', 'Validation failed', { details: { issues }, status: 422 });

export const unauthenticated = (message = 'Authentication required') =>
  new ApiError('UNAUTHENTICATED', message, {
    headers: { 'WWW-Authenticate': 'Bearer realm="orbit"' },
  });

export const forbiddenRole = (message = 'Your role does not allow this action') =>
  new ApiError('FORBIDDEN_ROLE', message);

export const forbiddenScope = (message = 'You do not have access to this resource') =>
  new ApiError('FORBIDDEN_SCOPE', message);

/**
 * Cross-tenant reads answer 404 — never 403 (rule 6: no resource enumeration).
 */
export const notFound = (resource = 'Resource', details?: Record<string, unknown>) =>
  new ApiError('RESOURCE_NOT_FOUND', `${resource} not found`, { details });

export const conflict = (message: string, details?: Record<string, unknown>) =>
  new ApiError('VERSION_CONFLICT', message, { details });

export const duplicate = (message: string, details?: Record<string, unknown>) =>
  new ApiError('DUPLICATE_RESOURCE', message, { details });

export const rateLimited = (retryAfterSeconds: number, message = 'Too many requests') =>
  new ApiError('RATE_LIMITED', message, { headers: { 'Retry-After': String(retryAfterSeconds) } });

export const dependencyUnavailable = (dependency: string) =>
  new ApiError('DEPENDENCY_UNAVAILABLE', `${dependency} is temporarily unavailable`);

export const lockBusy = (message = 'Another operation is in progress — retry shortly') =>
  new ApiError('LOCK_BUSY', message);

export const quotaExceeded = (message = 'Quota exceeded') =>
  new ApiError('QUOTA_EXCEEDED', message);

export const seatLimitReached = () =>
  new ApiError('SEAT_LIMIT_REACHED', 'This workspace has reached its seat limit');

export const lastOwnerProtected = () =>
  new ApiError('LAST_OWNER_PROTECTED', 'A workspace must keep at least one owner');

export const inviteExpired = () =>
  new ApiError('INVITE_EXPIRED', 'This invitation has expired or was already used');

export const cycleDetected = (message = 'This move would create a cycle') =>
  new ApiError('CYCLE_DETECTED', message);

export const orderKeyExhausted = () =>
  new ApiError('ORDER_KEY_EXHAUSTED', 'Ordering keys in this list must be rebalanced');

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
