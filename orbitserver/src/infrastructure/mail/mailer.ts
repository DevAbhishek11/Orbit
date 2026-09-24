/**
 * Mail delivery — STUB until Phase 10 wires the BullMQ `mail` queue + MJML.
 * In development every "sent" mail is logged (structured, no PII leakage of
 * the token itself — tokens are logged only in dev to keep flows testable).
 */
import { env, isDev } from '../../config/env.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'mailer' });

export type MailTemplate =
  | 'verify_email'
  | 'password_reset'
  | 'workspace_invite'
  | 'generic';

export interface MailPayload {
  to: string;
  template: MailTemplate;
  subject: string;
  vars?: Record<string, string>;
}

/**
 * Queue a mail for delivery. Returns immediately; delivery is async.
 * Phase 10 replaces the body with `queues.mail.add(...)`.
 */
export function sendMail(payload: MailPayload): Promise<void> {
  if (isDev || env.NODE_ENV === 'test') {
    log.info(
      { to: payload.to, template: payload.template, subject: payload.subject, vars: payload.vars },
      '[mail-stub] email captured (SMTP not wired yet — Phase 10)',
    );
    return Promise.resolve();
  }
  log.warn({ template: payload.template }, 'sendMail called without a configured transport — dropped');
  return Promise.resolve();
}
