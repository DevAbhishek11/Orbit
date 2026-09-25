import type { ErrorCode } from "./errorCodes.js";

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

export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface ValidationDetails {
  issues: ValidationIssue[];
}

export interface VersionConflictDetails<T> {
  current: T;
  currentVersion: number;
  providedVersion?: number;
}
