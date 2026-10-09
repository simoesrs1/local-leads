import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { HistoryEntry } from '../src/app/models/email.model.ts';
import { createApp } from './app.ts';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, DEFAULT_VARIABLES } from './defaults.ts';
import type { Fetch, GoogleToken } from './google.ts';
import { type StoredSettings, createTransportFactory } from './mailer.ts';
import { memoryStore } from './store.ts';

const client: StoredSettings = {
  ...DEFAULT_SETTINGS,
  provider: 'gmail',
  googleClientId: 'client-123.apps.googleusercontent.com',
  googleClientSecret: 'client-secret',
  fromName: 'Rúben',
  testEmail: 'tests@example.com',
};

/** Fake Google endpoints; records every call. */
function fakeGoogle() {
  const calls: { url: string; body: string; auth?: string }[] = [];
  let refreshError: string | null = null;
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchFn: Fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : '';
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
    calls.push({ url, body, auth });

    if (url.endsWith('/token')) {
      const params = new URLSearchParams(body);
      if (params.get('grant_type') === 'authorization_code') {
        return json(200, {
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          scope: 'openid email https://www.googleapis.com/auth/gmail.send',
        });
      }
      if (refreshError) return json(400, { error: refreshError });
      return json(200, { access_token: 'access-2', expires_in: 3600 });
    }
    if (url.includes('/userinfo')) return json(200, { email: 'me@gmail.com' });
    if (url.includes('/messages/send')) return json(200, { id: 'msg-1' });
    if (url.includes('/revoke')) return json(200, {});
    return json(404, {});
  };
  return { fetchFn, calls, failRefresh: (error: string) => (refreshError = error) };
}

describe('Gmail API (OAuth) provider', () => {
  let server: Server;
  let base: string;
  let google: ReturnType<typeof fakeGoogle>;
  const settings = memoryStore<StoredSettings>(client);
  const token = memoryStore<GoogleToken | null>(null);
  const history = memoryStore<HistoryEntry[]>([]);

  before(async () => {
    google = fakeGoogle();
    // Indirection so each test can swap the fake.
    const fetchFn: Fetch = (input, init) => google.fetchFn(input, init);
    const app = createApp({
      settings,
      templates: memoryStore(DEFAULT_TEMPLATES),
      variables: memoryStore(DEFAULT_VARIABLES),
      history,
      googleToken: token,
      transport: createTransportFactory(fetchFn, token),
      fetch: fetchFn,
    });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  beforeEach(async () => {
    google = fakeGoogle();
    await settings.write(client);
    await token.write(null);
    await history.write([]);
  });

  const get = (path: string) => fetch(base + path, { redirect: 'manual' });
  const post = (path: string, body?: unknown) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /** Runs the whole consent flow against the fake Google. */
  async function connect(): Promise<Response> {
    const start = await get('/api/auth/google/start');
    const consent = new URL(start.headers.get('location')!);
    const state = consent.searchParams.get('state')!;
    return get(`/api/auth/google/callback?code=auth-code&state=${state}`);
  }

  it('redirects to Google asking only for the send permission', async () => {
    const response = await get('/api/auth/google/start');
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get('location')!);
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(url.searchParams.get('client_id'), client.googleClientId);
    assert.equal(url.searchParams.get('redirect_uri'), `${base}/api/auth/google/callback`);
    assert.match(url.searchParams.get('scope')!, /gmail\.send/);
    assert.doesNotMatch(url.searchParams.get('scope')!, /gmail\.readonly|mail\.google\.com/);
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.ok(url.searchParams.get('state')!.length > 20);
  });

  it('refuses to start without a client id/secret', async () => {
    await settings.write({ ...client, googleClientSecret: '' });
    const response = await get('/api/auth/google/start');
    assert.match(
      response.headers.get('location')!,
      /google=error&reason=EMAIL_ERRORS\.GOOGLE_CLIENT_MISSING/,
    );
  });

  it('stores the token and account after the callback', async () => {
    const response = await connect();
    assert.equal(response.headers.get('location'), '/settings?google=connected');
    assert.equal((await token.read())?.refreshToken, 'refresh-1');
    assert.equal((await settings.read()).googleAccount, 'me@gmail.com');

    const publicSettings = await (await get('/api/settings')).json();
    assert.equal(publicSettings.googleAccount, 'me@gmail.com');
    assert.equal(publicSettings.hasGoogleClientSecret, true);
    assert.equal(publicSettings.googleClientSecret, undefined);
    assert.equal(JSON.stringify(publicSettings).includes('refresh-1'), false);
  });

  it('rejects a callback with an unknown state (CSRF)', async () => {
    const response = await get('/api/auth/google/callback?code=x&state=forged');
    assert.match(response.headers.get('location')!, /reason=EMAIL_ERRORS\.GOOGLE_STATE/);
    assert.equal(await token.read(), null);
  });

  it('sends through the Gmail API, respecting test mode', async () => {
    await connect();
    const result = await (
      await post('/api/email/send', {
        leadId: 'a',
        leadName: 'Padaria',
        to: 'shop@example.pt',
        subject: 'Olá',
        text: 'Corpo',
      })
    ).json();
    assert.equal(result.status, 'sent');
    assert.equal(result.to, 'tests@example.com');

    const send = google.calls.find((call) => call.url.includes('/messages/send'))!;
    assert.equal(send.auth, 'Bearer access-1');
    const raw = Buffer.from(JSON.parse(send.body).raw, 'base64url').toString('utf8');
    assert.match(raw, /^To: tests@example\.com$/m);
    assert.match(raw, /^From: =\?UTF-8\?Q\?R=C3=BAben\?= <me@gmail\.com>$/m);
    assert.match(raw, /TESTE/);
    assert.doesNotMatch(raw, /^To: shop@example\.pt$/m);
  });

  it('refreshes an expired access token before sending', async () => {
    await connect();
    await token.write({ ...(await token.read())!, expiresAt: Date.now() - 1000 });
    await post('/api/email/send', { leadId: 'a', to: 'shop@example.pt', subject: 'S', text: 'T' });
    const refresh = google.calls.find((call) => call.body.includes('grant_type=refresh_token'));
    assert.ok(refresh);
    assert.equal((await token.read())?.accessToken, 'access-2');
    assert.equal(
      google.calls.find((call) => call.url.includes('/messages/send'))?.auth,
      'Bearer access-2',
    );
  });

  it('asks to reconnect when Google revoked the refresh token', async () => {
    await connect();
    await token.write({ ...(await token.read())!, expiresAt: 0 });
    google.failRefresh('invalid_grant');
    const result = await (
      await post('/api/email/send', { leadId: 'a', to: 'x@y.pt', subject: 'S', text: 'T' })
    ).json();
    assert.equal(result.status, 'failed');
    assert.equal(result.error, 'EMAIL_ERRORS.GOOGLE_REAUTH');
  });

  it('disconnect revokes the token and forgets the account', async () => {
    await connect();
    const response = await (await post('/api/auth/google/disconnect')).json();
    assert.equal(response.googleAccount, null);
    assert.equal(await token.read(), null);
    assert.ok(
      google.calls.some((call) => call.url.includes('/revoke') && call.body.includes('refresh-1')),
    );
  });

  it('changing the OAuth client disconnects the account', async () => {
    await connect();
    const current = await (await get('/api/settings')).json();
    await fetch(base + '/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current, googleClientId: 'other-client' }),
    });
    assert.equal(await token.read(), null);
    assert.equal((await settings.read()).googleAccount, null);
  });
});
