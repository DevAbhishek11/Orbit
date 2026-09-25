import pino, { type DestinationStream } from 'pino';
import { env, isDev } from '../../config/env.js';
import { getRequestContext } from './requestContext.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  '*.passwordHash',
  '*.password',
  'token',
  '*.token',
  'accessToken',
  'refreshToken',
  '*.refreshToken',
  'tokenHash',
  'cookie',
  '*.cookie',
  'authorization',
  'secret',
  '*.secret',
  'jwtSecret',
];

const mixin = (): Record<string, unknown> => {
  const ctx = getRequestContext();
  const out: Record<string, unknown> = {};
  if (ctx.requestId) out.requestId = ctx.requestId;
  if (ctx.userId) out.userId = ctx.userId;
  if (ctx.workspaceId) out.workspaceId = ctx.workspaceId;
  return out;
};

const transport: DestinationStream | undefined =
  isDev && env.LOG_PRETTY
    ? (pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }) as DestinationStream)
    : undefined;

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    base: {
      service: 'orbit-api',
      env: env.NODE_ENV,
      pid: process.pid,
      version: env.APP_VERSION,
      commit: env.GIT_SHA || undefined,
    },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    mixin,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  transport,
);

export function childLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}

export type Logger = pino.Logger;
