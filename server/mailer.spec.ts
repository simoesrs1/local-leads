import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SETTINGS } from './defaults.ts';
import { authUser, mergeSettings, smtpErrorKey, textToHtml } from './mailer.ts';

describe('textToHtml', () => {
  it('escapes HTML, keeps line breaks and links URLs', () => {
    const html = textToHtml('Olá <b>Ana</b>\nveja https://exemplo.pt\n\nObrigado');
    assert.match(html, /Olá &lt;b&gt;Ana&lt;\/b&gt;<br>veja <a href="https:\/\/exemplo\.pt">/);
    assert.match(html, /<p>Obrigado<\/p>/);
  });
});

describe('Gmail login helpers', () => {
  const update = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'me@gmail.com',
    password: 'abcd efgh ijkl mnop',
    fromName: '',
    fromEmail: 'me@gmail.com',
    testMode: true,
    testEmail: '',
  };

  it('removes the spaces Google shows in app passwords (Gmail only)', () => {
    assert.equal(mergeSettings(DEFAULT_SETTINGS, update).password, 'abcdefghijklmnop');
    const other = mergeSettings(DEFAULT_SETTINGS, { ...update, host: 'smtp.example.com' });
    assert.equal(other.password, 'abcd efgh ijkl mnop');
  });

  it('logs in with the sender address when the username is empty', () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, { ...update, user: '' });
    assert.equal(authUser(settings), 'me@gmail.com');
  });

  it('explains 535 errors, with Gmail-specific help', () => {
    const error = Object.assign(
      new Error('Invalid login: 535-5.7.8 Username and Password not accepted'),
      {
        responseCode: 535,
      },
    );
    const gmail = mergeSettings(DEFAULT_SETTINGS, update);
    assert.equal(smtpErrorKey(gmail, error), 'EMAIL_ERRORS.GMAIL_AUTH_FAILED');
    assert.equal(
      smtpErrorKey({ ...gmail, host: 'smtp.example.com' }, error),
      'EMAIL_ERRORS.AUTH_FAILED',
    );
    assert.equal(smtpErrorKey(gmail, new Error('ECONNREFUSED')), 'EMAIL_ERRORS.SMTP_FAILED');
  });
});
