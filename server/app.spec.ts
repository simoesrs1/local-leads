import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.ts';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, DEFAULT_VARIABLES } from './defaults.ts';
import type { HistoryEntry } from '../src/app/models/email.model.ts';
import type { StoredSettings, TransportFactory } from './mailer.ts';
import { memoryStore } from './store.ts';

const configured: StoredSettings = {
  ...DEFAULT_SETTINGS,
  host: 'smtp.example.com',
  user: 'me@example.com',
  password: 'secret-password',
  fromName: 'Rúben',
  fromEmail: 'me@example.com',
  testEmail: 'tests@example.com',
};

describe('email API', () => {
  let server: Server;
  let base: string;
  let sent: { to: string; subject: string; text: string }[];
  let settings: ReturnType<typeof memoryStore<StoredSettings>>;
  const history = memoryStore<HistoryEntry[]>([]);
  let failNext = false;

  // Fake SMTP transport that records messages instead of sending them.
  const transport: TransportFactory = () =>
    ({
      sendMail: async (mail: { to: string; subject: string; text: string }) => {
        if (failNext) {
          failNext = false;
          throw new Error('550 mailbox unavailable');
        }
        sent.push(mail);
        return {} as never;
      },
      verify: async () => true,
    }) as never;

  before(async () => {
    settings = memoryStore(configured);
    const app = createApp({
      settings,
      templates: memoryStore(DEFAULT_TEMPLATES),
      variables: memoryStore(DEFAULT_VARIABLES),
      history,
      transport,
    });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  beforeEach(async () => {
    sent = [];
    await settings.write(configured);
    await history.write([]);
  });

  const call = (path: string, method = 'GET', body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it('never returns the password', async () => {
    const response = await (await call('/api/settings')).json();
    assert.equal(response.password, undefined);
    assert.equal(response.hasPassword, true);
  });

  it('keeps the stored password when the update leaves it blank', async () => {
    const { password: _password, ...rest } = configured;
    await call('/api/settings', 'PUT', { ...rest, password: '', fromName: 'Novo' });
    const stored = await settings.read();
    assert.equal(stored.password, 'secret-password');
    assert.equal(stored.fromName, 'Novo');
  });

  it('redirects every email to the test address in test mode', async () => {
    const result = await (
      await call('/api/email/send', 'POST', {
        leadId: 'osm:node/1',
        to: 'business@example.pt',
        subject: 'Olá',
        text: 'Corpo',
      })
    ).json();

    assert.equal(result.status, 'sent');
    assert.equal(result.testMode, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'tests@example.com');
    assert.equal(sent[0].subject, '[TESTE] Olá');
    assert.match(sent[0].text, /business@example\.pt/);
  });

  it('sends test emails even for leads without an address', async () => {
    const result = await (
      await call('/api/email/send', 'POST', { leadId: 'x', to: null, subject: 'S', text: 'T' })
    ).json();
    assert.equal(result.status, 'sent');
    assert.equal(sent[0].to, 'tests@example.com');
  });

  it('sends to the business in live mode and skips leads without email', async () => {
    await settings.write({ ...configured, testMode: false });

    const ok = await (
      await call('/api/email/send', 'POST', {
        leadId: 'a',
        to: 'shop@example.pt',
        subject: 'S',
        text: 'T',
      })
    ).json();
    const skipped = await (
      await call('/api/email/send', 'POST', { leadId: 'b', to: null, subject: 'S', text: 'T' })
    ).json();

    assert.equal(ok.status, 'sent');
    assert.equal(sent[0].to, 'shop@example.pt');
    assert.equal(sent[0].subject, 'S');
    assert.equal(skipped.status, 'skipped');
    assert.equal(sent.length, 1);
  });

  it('refuses to send while SMTP is not configured', async () => {
    await settings.write(DEFAULT_SETTINGS);
    const response = await call('/api/email/send', 'POST', {
      leadId: 'a',
      to: 'a@b.pt',
      subject: 'S',
      text: 'T',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'EMAIL_ERRORS.SMTP_INCOMPLETE');
    assert.equal(sent.length, 0);
  });

  it('rejects invalid or duplicate variable keys', async () => {
    const duplicate = [
      { label: 'A', key: 'a', source: 'name', value: '' },
      { label: 'A2', key: 'a', source: 'type', value: '' },
    ];
    assert.equal((await call('/api/variables', 'PUT', duplicate)).status, 400);
    assert.equal(
      (
        await call('/api/variables', 'PUT', [
          { label: 'X', key: 'Bad Key', source: 'name', value: '' },
        ])
      ).status,
      400,
    );
  });

  it('logs test and live sends (and failures) in the history, newest first', async () => {
    const message = {
      leadId: 'osm:node/1',
      leadName: 'Padaria Central',
      to: 'geral@padaria.pt',
      subject: 'Olá',
      text: 'T',
      templateId: 'website-intro',
      templateName: 'Apresentação',
    };
    await call('/api/email/send', 'POST', message);
    await settings.write({ ...configured, testMode: false });
    await call('/api/email/send', 'POST', message);
    failNext = true;
    await call('/api/email/send', 'POST', { ...message, leadId: 'osm:node/2', to: 'x@y.pt' });

    const entries: HistoryEntry[] = await (await call('/api/history')).json();
    assert.equal(entries.length, 3);
    const [failed, live, test] = entries;
    assert.equal(test.testMode, true);
    assert.equal(test.to, 'tests@example.com');
    assert.equal(test.leadEmail, 'geral@padaria.pt');
    assert.equal(live.testMode, false);
    assert.equal(live.to, 'geral@padaria.pt');
    assert.equal(live.templateName, 'Apresentação');
    assert.equal(failed.status, 'failed');
    assert.match(failed.error ?? '', /550/);
  });

  it('does not log skipped leads (live mode without email)', async () => {
    await settings.write({ ...configured, testMode: false });
    await call('/api/email/send', 'POST', { leadId: 'b', to: null, subject: 'S', text: 'T' });
    assert.equal((await history.read()).length, 0);
  });

  it('deletes one entry or clears only the test entries', async () => {
    await call('/api/email/send', 'POST', { leadId: 'a', to: 'a@b.pt', subject: 'S', text: 'T' });
    await settings.write({ ...configured, testMode: false });
    await call('/api/email/send', 'POST', { leadId: 'a', to: 'a@b.pt', subject: 'S', text: 'T' });
    await call('/api/email/send', 'POST', { leadId: 'c', to: 'c@b.pt', subject: 'S', text: 'T' });

    assert.equal((await call('/api/history?testOnly=true', 'DELETE')).status, 204);
    let entries: HistoryEntry[] = await (await call('/api/history')).json();
    assert.deepEqual(
      entries.map((entry) => entry.testMode),
      [false, false],
    );

    await call(`/api/history/${entries[0].id}`, 'DELETE');
    entries = await (await call('/api/history')).json();
    assert.equal(entries.length, 1);
  });
});
