import nodemailer, { type SendMailOptions } from 'nodemailer';
import type { Store } from './store.ts';

/**
 * Gmail API over OAuth 2.0 (no SMTP, no password). Only the `gmail.send` scope is requested:
 * the app can send as the user but cannot read the mailbox.
 */
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'];

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/** Stored in google-token.json (0600). The refresh token is what keeps the app connected. */
export interface GoogleToken {
  refreshToken: string;
  accessToken: string;
  /** Epoch ms when `accessToken` expires. */
  expiresAt: number;
  email: string;
}

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
}

export type Fetch = typeof fetch;

/** Error the UI turns into "reconnect your Google account" (e.g. revoked or expired refresh token). */
export class GoogleReauthError extends Error {
  readonly code = 'GOOGLE_REAUTH';
}

export function authorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // offline + consent => Google returns a refresh token every time the user connects.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(fetchFn: Fetch, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = (await response.json()) as TokenResponse;
  if (!response.ok) {
    // invalid_grant = refresh token revoked/expired (e.g. 7-day limit while the app is in "Testing").
    if (json.error === 'invalid_grant')
      throw new GoogleReauthError(json.error_description ?? json.error);
    throw new Error(`Google OAuth: ${json.error_description ?? json.error ?? response.status}`);
  }
  return json;
}

/** Exchanges the authorization code from the callback for tokens and the account email. */
export async function exchangeCode(
  fetchFn: Fetch,
  client: GoogleClient,
  redirectUri: string,
  code: string,
): Promise<GoogleToken> {
  const tokens = await tokenRequest(fetchFn, {
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (!tokens.refresh_token) throw new Error('Google OAuth: no refresh token returned');
  if (!tokens.scope?.includes('gmail.send')) {
    throw new Error('Google OAuth: the "send email" permission was not granted');
  }

  const userinfo = await fetchFn(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const { email } = (await userinfo.json()) as { email?: string };
  if (!userinfo.ok || !email) throw new Error('Google OAuth: could not read the account email');

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    email,
  };
}

/** Best effort: revokes the refresh token at Google (also invalidates its access tokens). */
export async function revokeToken(fetchFn: Fetch, token: string): Promise<void> {
  await fetchFn(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

/** Returns a valid access token, refreshing (and persisting) it when it is about to expire. */
export async function accessToken(
  fetchFn: Fetch,
  client: GoogleClient,
  store: Store<GoogleToken | null>,
): Promise<string> {
  const token = await store.read();
  if (!token) throw new GoogleReauthError('Google account not connected');
  if (token.expiresAt - 60_000 > Date.now()) return token.accessToken;

  const refreshed = await tokenRequest(fetchFn, {
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: token.refreshToken,
    grant_type: 'refresh_token',
  });
  const next: GoogleToken = {
    ...token,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
    // Google may rotate the refresh token.
    refreshToken: refreshed.refresh_token ?? token.refreshToken,
  };
  await store.write(next);
  return next.accessToken;
}

/** Builds the RFC 822 message with Nodemailer (no network) and encodes it for the Gmail API. */
export async function buildRawMessage(mail: SendMailOptions): Promise<string> {
  const compiler = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'unix',
  });
  const info = await compiler.sendMail(mail);
  return (info.message as Buffer).toString('base64url');
}

/** Same interface as a Nodemailer transport, backed by the Gmail API. */
export function gmailTransport(
  fetchFn: Fetch,
  client: GoogleClient,
  store: Store<GoogleToken | null>,
) {
  return {
    async verify(): Promise<true> {
      const token = await accessToken(fetchFn, client, store);
      const response = await fetchFn(USERINFO_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Google userinfo ${response.status}`);
      return true;
    },

    async sendMail(mail: SendMailOptions): Promise<{ messageId: string }> {
      const token = await accessToken(fetchFn, client, store);
      const response = await fetchFn(SEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: await buildRawMessage(mail) }),
      });
      const json = (await response.json()) as { id?: string; error?: { message?: string } };
      if (response.status === 401)
        throw new GoogleReauthError(json.error?.message ?? 'Unauthorized');
      if (!response.ok)
        throw new Error(`Gmail API ${response.status}: ${json.error?.message ?? ''}`);
      return { messageId: json.id ?? '' };
    },
  };
}
