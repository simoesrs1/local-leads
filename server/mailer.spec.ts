import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { textToHtml } from './mailer.ts';

describe('textToHtml', () => {
  it('escapes HTML, keeps line breaks and links URLs', () => {
    const html = textToHtml('Olá <b>Ana</b>\nveja https://exemplo.pt\n\nObrigado');
    assert.match(html, /Olá &lt;b&gt;Ana&lt;\/b&gt;<br>veja <a href="https:\/\/exemplo\.pt">/);
    assert.match(html, /<p>Obrigado<\/p>/);
  });
});
