import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorKey } from './email-api.service';

describe('apiErrorKey', () => {
  it('uses the translation key sent by the server', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { error: 'EMAIL_ERRORS.FROM_INVALID' },
    });
    expect(apiErrorKey(error)).toBe('EMAIL_ERRORS.FROM_INVALID');
  });

  it('detects that the email server is not running (bare proxy error)', () => {
    expect(apiErrorKey(new HttpErrorResponse({ status: 500, error: '' }))).toBe(
      'EMAIL_ERRORS.SERVER_OFFLINE',
    );
    expect(apiErrorKey(new HttpErrorResponse({ status: 0 }))).toBe('EMAIL_ERRORS.SERVER_OFFLINE');
  });

  it('falls back to a generic error', () => {
    expect(apiErrorKey(new Error('boom'))).toBe('EMAIL_ERRORS.SERVER_ERROR');
  });
});
