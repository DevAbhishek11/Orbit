/**
 * Audit service (BUILD_PROMPT Phase 4, rule 18):
 * every mutation writes an audit entry. Audit writes NEVER block the response
 * — fire-and-forget with error capture, unless the caller passes a session
 * (then the audit entry is part of the same atomic transaction).
 */
import type { ClientSession } from 'mongoose';
import { AuditLogModel, type IAuditLog } from './auditlogs.model.js';
import { childLogger } from '../../infrastructure/logger/index.js';
import { getRequestContext } from '../../infrastructure/logger/requestContext.js';

const log = childLogger({ module: 'audit' });

export interface AuditInput {
  actorId: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  workspaceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  /** When provided, the audit write joins the caller's transaction. */
  session?: ClientSession;
}

/** Cap snapshot sizes so a huge document can never bloat the audit trail. */
function boundSnapshot(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const json = JSON.stringify(value);
  if (json.length <= 16_000) return value;
  return { _truncated: true, _size: json.length };
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const ctx = getRequestContext();
  const doc: IAuditLog = {
    workspaceId: input.workspaceId ?? ctx.workspaceId,
    actorId: input.actorId,
    actorRole: input.actorRole ?? ctx.role,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: boundSnapshot(input.before),
    after: boundSnapshot(input.after),
    ip: input.ip ?? ctx.ip,
    userAgent: input.userAgent,
    requestId: input.requestId ?? ctx.requestId,
    at: new Date(),
  };

  if (input.session) {
    // Atomic path — the caller owns failure handling inside the transaction.
    await AuditLogModel.create([doc], { session: input.session });
    return;
  }

  try {
    await AuditLogModel.create([doc]);
  } catch (err) {
    // Audit failure must never fail the user's request — but it is loud.
    log.error({ err, action: doc.action, entityId: doc.entityId }, 'audit write failed');
  }
}

/** Fire-and-forget wrapper for controller/service call sites. */
export function recordAuditAsync(input: AuditInput): void {
  void recordAudit(input);
}
