import nodemailer, { type Transporter } from 'nodemailer';
import { env, isDev } from '../../config/env.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'mailer' });

export type MailTemplate = 'verify_email' | 'password_reset' | 'workspace_invite' | 'generic';

export interface MailPayload {
  to: string;
  template: MailTemplate;
  subject: string;
  vars?: Record<string, string>;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true for 465, false for 587/2525 (STARTTLS upgrade)
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    log.info(
      { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE },
      'SMTP transport initialized',
    );
  }
  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderText(template: MailTemplate, vars: Record<string, string>): string {
  const name = vars.name ?? 'there';
  const url = vars.url ?? '';
  switch (template) {
    case 'verify_email':
      return `Hi ${name},\n\nPlease confirm your email address by opening this link:\n${url}\n\nIf you did not create an account, you can ignore this email.`;
    case 'password_reset':
      return `Hi ${name},\n\nWe received a request to reset your password. Open this link to choose a new one:\n${url}\n\nThe link expires in 30 minutes. If you did not request this, you can ignore this email.`;
    case 'workspace_invite':
      return `You have been invited to join ${vars.workspace ?? 'a workspace'}.\n\nAccept the invitation here:\n${url}\n\nIf you were not expecting this invitation, you can ignore this email.`;
    default:
      return url ? `Details: ${url}` : '';
  }
}

function renderHtml(subject: string, template: MailTemplate, vars: Record<string, string>): string {
  const name = escapeHtml(vars.name ?? 'there');
  const url = vars.url ?? '';
  let body: string;
  switch (template) {
    case 'verify_email':
      body = `<p>Hi ${name},</p><p>Please confirm your email address to finish setting up your account.</p>`;
      break;
    case 'password_reset':
      body = `<p>Hi ${name},</p><p>We received a request to reset your password. The link below expires in 30 minutes.</p>`;
      break;
    case 'workspace_invite':
      body = `<p>You have been invited to join <strong>${escapeHtml(vars.workspace ?? 'a workspace')}</strong>.</p>`;
      break;
    default:
      body = `<p>Hi ${name},</p>`;
  }
  const button = url
    ? `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#f97316;color:#ffffff;text-decoration:none;font-weight:600;">Open Orbit</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2430;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
    <h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(subject)}</h1>
    <div style="font-size:14px;line-height:1.6;color:#3a4150;">${body}${button}</div>
    <p style="font-size:12px;color:#8a919f;margin:20px 0 0;">If the button does not work, copy this link into your browser:<br/>${escapeHtml(url)}</p>
  </div>
</body></html>`;
}

export async function sendMail(payload: MailPayload): Promise<void> {
  const transport = getTransporter();
  const vars = payload.vars ?? {};

  if (!transport) {
    if (isDev || env.NODE_ENV === 'test') {
      log.info(
        { to: payload.to, template: payload.template, subject: payload.subject, vars },
        '[mail-stub] email captured (set SMTP_HOST/SMTP_USER/SMTP_PASS to send real mail)',
      );
      return;
    }
    log.warn(
      { template: payload.template },
      'sendMail called without a configured transport — dropped',
    );
    return;
  }

  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: renderText(payload.template, vars),
      html: renderHtml(payload.subject, payload.template, vars),
    });
    log.info({ to: payload.to, template: payload.template }, 'email sent via SMTP');
  } catch (err) {
    // Never fail the caller's request because mail is down; surface it loudly instead.
    log.error({ err, to: payload.to, template: payload.template }, 'failed to send email via SMTP');
  }
}
