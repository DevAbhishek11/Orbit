/**
 * Central error handling (BUILD_PROMPT Phase 2, rule 21):
 *  - ApiError → its catalogue status/code, details allowed
 *  - Mongoose ValidationError/CastError → 422/400 without leaking schema
 *  - duplicate key (E11000) → 409 DUPLICATE_RESOURCE
 *  - payload too large → 413
 *  - unknown → 500 INTERNAL_ERROR, logged with stack, never leaked
 * Every error response carries the requestId from the ALS context.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ErrorCodes } from '@orbit/shared';
import { ApiError, isApiError } from '../infrastructure/errors/ApiError.js';
import { logger } from '../infrastructure/logger/index.js';
import { getRequestContext } from '../infrastructure/logger/requestContext.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  const requestId = getRequestContext().requestId ?? req.id ?? '-';
  res.status(404).json({
    success: false,
    error: {
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: `Route ${req.method} ${req.path} does not exist`,
      requestId,
    },
  });
};

function toApiError(err: unknown): ApiError {
  if (isApiError(err)) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    return new ApiError('VALIDATION_ERROR', 'Validation failed', {
      status: 422,
      details: {
        issues: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
      },
      cause: err,
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return new ApiError('VALIDATION_ERROR', `Invalid value for "${err.path}"`, {
      status: 400,
      cause: err,
    });
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const mongoErr = err as { code?: number | string; keyValue?: Record<string, unknown> };
    if (mongoErr.code === 11000) {
      return new ApiError('DUPLICATE_RESOURCE', 'Resource already exists', {
        status: 409,
        details: { fields: Object.keys(mongoErr.keyValue ?? {}) },
        cause: err,
      });
    }
  }
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const bodyErr = err as { type?: string };
    if (bodyErr.type === 'entity.too.large') {
      return new ApiError('VALIDATION_ERROR', 'Payload exceeds the 1 MB limit', {
        status: 413,
        cause: err,
      });
    }
    if (bodyErr.type === 'entity.parse.failed') {
      return new ApiError('VALIDATION_ERROR', 'Request body is not valid JSON', {
        status: 400,
        cause: err,
      });
    }
  }

  return new ApiError('INTERNAL_ERROR', 'An unexpected error occurred', {
    status: 500,
    cause: err,
  });
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const apiError = toApiError(err);
  const requestId = getRequestContext().requestId ?? req.id ?? '-';

  const logPayload = {
    err: apiError.cause ?? apiError,
    code: apiError.code,
    status: apiError.status,
    method: req.method,
    path: req.originalUrl,
    stack: apiError.expected ? undefined : apiError.stack,
  };
  if (apiError.status >= 500) logger.error(logPayload, 'request failed');
  else logger.warn(logPayload, 'request rejected');

  if (res.headersSent) {
    // Nothing we can do except close the connection cleanly.
    res.end();
    return;
  }

  for (const [header, value] of Object.entries(apiError.headers ?? {})) {
    res.setHeader(header, value);
  }
  res.status(apiError.status).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
      requestId,
    },
  });
};
