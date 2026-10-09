import nodemailer, { type SendMailOptions } from 'nodemailer';
import type {
  EmailSettings,
  EmailSettingsUpdate,
  SendEmailRequest,
} from '../src/app/models/email.model.ts';
import { type Fetch, type GoogleToken, gmailTransport } from './google.ts';
import type { Store } from './store.ts';

/** Settings as stored on disk (includes secrets). Never sent to the browser as-is. */
export interface StoredSettings extends Omit<
  EmailSettings,
  'hasPassword' | 'hasGoogleClientSecret' | 'googleRedirectUri'
> {
  password: string;
  googleClientSecret: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string | null | undefined): value is string {
  return !!value && EMAIL.test(value.trim());
}

/** Strips secrets before sending settings to the browser. */
export function toPublicSettings(
  { password, googleClientSecret, ...settings }: StoredSettings,
  googleRedirectUri: string,
): EmailSettings {
  return {
    ...settings,
    hasPassword: !!password,
    hasGoogleClientSecret: !!googleClientSecret,
    googleRedirectUri,
  };
}

/** Fills fields added in later versions; old files without `provider` were SMTP setups. */
export function normalizeSettings(
  raw: Partial<StoredSettings>,
  defaults: StoredSettings,
): StoredSettings {
  return {
    ...defaults,
    ...raw,
    provider: raw.provider ?? (raw.host ? 'smtp' : defaults.provider),
  };
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
    provider: update.provider === 'smtp' ? 'smtp' : 'gmail',
    googleClientId: (update.googleClientId ?? '').trim(),
    googleClientSecret: update.googleClientSecret?.trim() || current.googleClientSecret,
    // Set only by the OAuth callback, never by the browser.
    googleAccount: current.googleAccount,
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
  if (settings.provider === 'gmail') {
    if (!settings.googleClientId || !settings.googleClientSecret)
      return 'EMAIL_ERRORS.GOOGLE_CLIENT_MISSING';
    if (!settings.googleAccount) return 'EMAIL_ERRORS.GOOGLE_NOT_CONNECTED';
  } else {
    if (!settings.host || !Number.isInteger(settings.port) || settings.port <= 0) {
      return 'EMAIL_ERRORS.SMTP_INCOMPLETE';
    }
    if (!isEmail(settings.fromEmail)) return 'EMAIL_ERRORS.FROM_INVALID';
  }
  if (settings.testMode && !isEmail(testAddress(settings)))
    return 'EMAIL_ERRORS.TEST_EMAIL_INVALID';
  return null;
}

/** Address emails are sent from: the connected Google account, or the SMTP sender. */
export function senderAddress(settings: StoredSettings): string {
  return settings.provider === 'gmail' ? (settings.googleAccount ?? '') : settings.fromEmail;
}

/** Test emails go to `testEmail`, or to the sender's own address when it is empty. */
export function testAddress(settings: StoredSettings): string {
  return settings.testEmail || senderAddress(settings);
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

/** Minimal transport interface shared by SMTP (Nodemailer) and the Gmail API. */
export interface MailTransport {
  sendMail(mail: SendMailOptions): Promise<unknown>;
  verify(): Promise<unknown>;
}

export type TransportFactory = (settings: StoredSettings) => MailTransport;

export function smtpTransport(settings: StoredSettings): MailTransport {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: authUser(settings) ? { user: authUser(settings), pass: settings.password } : undefined,
  });
}

/** Picks the transport for the configured provider. */
export function createTransportFactory(
  fetchFn: Fetch,
  googleToken: Store<GoogleToken | null>,
): TransportFactory {
  return (settings) =>
    settings.provider === 'gmail'
      ? gmailTransport(
          fetchFn,
          { clientId: settings.googleClientId, clientSecret: settings.googleClientSecret },
          googleToken,
        )
      : smtpTransport(settings);
}

/** "Rúben Simões <ruben@example.pt>" */
export function fromHeader(settings: StoredSettings): string {
  const address = senderAddress(settings);
  return settings.fromName ? `"${settings.fromName.replace(/"/g, '')}" <${address}>` : address;
}

/** Login user; falls back to the sender address when only a password is set (e.g. Gmail). */
export function authUser(settings: StoredSettings): string {
  return settings.user || (settings.password ? settings.fromEmail : '');
}

/** Turns a send/verify error into a translation key; 535 = the SMTP server rejected user/password. */
export function smtpErrorKey(settings: StoredSettings, error: unknown): string {
  const { responseCode, message, code } = (error ?? {}) as {
    responseCode?: number;
    message?: string;
    code?: string;
  };
  if (code === 'GOOGLE_REAUTH') return 'EMAIL_ERRORS.GOOGLE_REAUTH';
  if (settings.provider === 'gmail') return 'EMAIL_ERRORS.GOOGLE_SEND_FAILED';
  const authFailed =
    responseCode === 535 || /\b535\b|invalid login|badcredentials/i.test(message ?? '');
  if (!authFailed) return 'EMAIL_ERRORS.SMTP_FAILED';
  return isGmail(settings.host) ? 'EMAIL_ERRORS.GMAIL_AUTH_FAILED' : 'EMAIL_ERRORS.AUTH_FAILED';
}
