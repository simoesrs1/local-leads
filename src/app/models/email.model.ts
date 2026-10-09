/**
 * Email types shared by the Angular app and the Node server (server/ imports this file),
 * so both sides always agree on the API contract.
 */

/** SMTP account used to send emails. */
export interface SmtpSettings {
  host: string;
  port: number;
  /** true = TLS from the start (port 465); false = STARTTLS when available (port 587). */
  secure: boolean;
  user: string;
  fromName: string;
  fromEmail: string;
}

/** How emails are sent: Gmail API with OAuth (recommended) or a classic SMTP account. */
export type EmailProvider = 'gmail' | 'smtp';

/** Settings shared by the browser view and the browser update. */
interface CommonSettings extends SmtpSettings {
  provider: EmailProvider;
  /** OAuth client id from Google Cloud Console (not secret). */
  googleClientId: string;
  /** When true, every email goes to `testEmail` instead of the business. */
  testMode: boolean;
  testEmail: string;
}

/** Settings as returned to the browser: passwords, secrets and tokens never leave the server. */
export interface EmailSettings extends CommonSettings {
  hasPassword: boolean;
  hasGoogleClientSecret: boolean;
  /** Gmail address authorised through OAuth, or null when not connected. */
  googleAccount: string | null;
  /** Redirect URI to register in Google Cloud Console (depends on the URL the app runs on). */
  googleRedirectUri: string;
}

/** Settings sent by the browser. Empty/missing secrets keep the stored ones. */
export interface EmailSettingsUpdate extends CommonSettings {
  password?: string;
  googleClientSecret?: string;
}

/** Lead data a template variable can be bound to. */
export const LEAD_FIELDS = [
  'name',
  'type',
  'email',
  'phone',
  'website',
  'address',
  'locality',
] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

/**
 * A template key. `label` "Nome Cliente" becomes the placeholder {{nome_cliente}} (`key`)
 * and is replaced by the bound lead field, or by the fixed `value` when source is "custom".
 */
export interface TemplateVariable {
  label: string;
  key: string;
  source: LeadField | 'custom';
  value: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
}

/** One already-rendered email; the server only decides the final recipient (test mode). */
export interface SendEmailRequest {
  leadId: string;
  to: string | null;
  subject: string;
  text: string;
  /** Kept in the history so entries stay readable after the search results are gone. */
  leadName?: string;
  templateId?: string;
  templateName?: string;
}

/** One send attempt, stored by the server in history.json. */
export interface HistoryEntry {
  id: string;
  leadId: string;
  leadName: string;
  /** The business's address, even when test mode redirected the email elsewhere. */
  leadEmail: string | null;
  /** Address the email was actually delivered to. */
  to: string;
  subject: string;
  templateId: string | null;
  templateName: string | null;
  testMode: boolean;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: string;
}

export type SendStatus = 'sent' | 'skipped' | 'failed';

export interface SendEmailResult {
  leadId: string;
  status: SendStatus;
  /** Address the email was actually sent to (the test address in test mode). */
  to: string | null;
  testMode: boolean;
  /** Translation key explaining a failure or skip. */
  error?: string;
  /** Technical message from the SMTP server, if any. */
  detail?: string;
}

/** Error body returned by the server: a translation key plus optional technical detail. */
export interface ApiError {
  error: string;
  detail?: string;
}
