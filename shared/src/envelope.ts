/**
 * Response envelope contract (BUILD_PROMPT §4) — never deviate.
 *
 * success: { success: true,  data, meta: { requestId, nextCursor?, cached? } }
 * error:   { success: false, error: { code, message, details?, requestId } }
 */
import type { ErrorCode } from './errorCodes.js';

export interface ResponseMeta {
  requestId: string;
  nextCursor?: string | null;
  cached?: boolean;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorBody;
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/** Field-level validation issue reported inside a 422 error body. */
export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

/** Shape of `details` for VALIDATION_ERROR responses. */
export interface ValidationDetails {
  issues: ValidationIssue[];
}

/** Shape of `details` for VERSION_CONFLICT responses (409 carries current doc). */
export interface VersionConflictDetails<T> {
  current: T;
  currentVersion: number;
  providedVersion?: number;
}
