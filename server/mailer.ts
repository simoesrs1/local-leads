import nodemailer, { type Transporter } from 'nodemailer';
import type {
  EmailSettings,
  EmailSettingsUpdate,
  SendEmailRequest,
} from '../src/app/models/email.model.ts';

/** Settings as stored on disk (includes the password). Never sent to the browser. */
export interface StoredSettings extends Omit<EmailSettings, 'hasPassword'> {
  password: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string | null | undefined): value is string {
  return !!value && EMAIL.test(value.trim());
}

/** Strips the password before sending settings to the browser. */
export function toPublicSettings({ password, ...settings }: StoredSettings): EmailSettings {
  return { ...settings, hasPassword: !!password };
}

export function isGmail(host: string): boolean {
  return /(^|\.)(gmail|googlemail)\.com$/i.test(host.trim());
}

/** Applies an update from the browser; a blank password keeps the stored one. */
export function mergeSettings(
  current: StoredSettings,
  update: EmailSettingsUpdate,
): StoredSettings {
  return {
    host: update.host.trim(),
    port: Number(update.port),
    secure: !!update.secure,
    user: update.user.trim(),
    // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces are not part of it.
    password: update.password
      ? isGmail(update.host)
        ? update.password.replace(/\s+/g, '')
        : update.password
      : current.password,
    fromName: update.fromName.trim(),
    fromEmail: update.fromEmail.trim(),
    testMode: !!update.testMode,
    testEmail: update.testEmail.trim(),
  };
}

/** Returns a translation key describing what is wrong, or null when settings are usable. */
export function validateSettings(settings: StoredSettings): string | null {
  if (!settings.host || !Number.isInteger(settings.port) || settings.port <= 0) {
    return 'EMAIL_ERRORS.SMTP_INCOMPLETE';
  }
  if (!isEmail(settings.fromEmail)) return 'EMAIL_ERRORS.FROM_INVALID';
  if (settings.testMode && !isEmail(testAddress(settings)))
    return 'EMAIL_ERRORS.TEST_EMAIL_INVALID';
  return null;
}

/** Test emails go to `testEmail`, or to the sender's own address when it is empty. */
export function testAddress(settings: StoredSettings): string {
  return settings.testEmail || settings.fromEmail;
}

export interface Delivery {
  to: string;
  subject: string;
  text: string;
}

/**
 * Decides who actually receives a message. Enforced here (server side) so test mode
 * cannot be bypassed by the browser: in test mode the business never gets the email.
 */
export function resolveDelivery(
  settings: StoredSettings,
  message: SendEmailRequest,
): Delivery | { skipped: string } {
  if (settings.testMode) {
    const note = `[Modo de teste] Destinatário original: ${message.to || '(sem email)'}\n\n`;
    return {
      to: testAddress(settings),
      subject: `[TESTE] ${message.subject}`,
      text: note + message.text,
    };
  }
  if (!isEmail(message.to)) return { skipped: 'EMAIL_ERRORS.NO_RECIPIENT' };
  return { to: message.to.trim(), subject: message.subject, text: message.text };
}

/** Plain text -> minimal HTML (escaped, paragraphs and line breaks kept, links clickable). */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const linked = escaped.replace(/\bhttps?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`);
  const paragraphs = linked
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">${paragraphs.join('')}</div>`;
}

export type TransportFactory = (
  settings: StoredSettings,
) => Pick<Transporter, 'sendMail' | 'verify'>;

export const smtpTransport: TransportFactory = (settings) =>
  nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: authUser(settings) ? { user: authUser(settings), pass: settings.password } : undefined,
  });

/** "Rúben Simões <ruben@example.pt>" */
export function fromHeader(settings: StoredSettings): string {
  return settings.fromName
    ? `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>`
    : settings.fromEmail;
}

/** Login user; falls back to the sender address when only a password is set (e.g. Gmail). */
export function authUser(settings: StoredSettings): string {
  return settings.user || (settings.password ? settings.fromEmail : '');
}

/** Turns an SMTP error into a translation key; 535 = the server rejected user/password. */
export function smtpErrorKey(settings: StoredSettings, error: unknown): string {
  const { responseCode, message } = (error ?? {}) as { responseCode?: number; message?: string };
  const authFailed =
    responseCode === 535 || /\b535\b|invalid login|badcredentials/i.test(message ?? '');
  if (!authFailed) return 'EMAIL_ERRORS.SMTP_FAILED';
  return isGmail(settings.host) ? 'EMAIL_ERRORS.GMAIL_AUTH_FAILED' : 'EMAIL_ERRORS.AUTH_FAILED';
}
