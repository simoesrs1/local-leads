import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiError,
  EmailSettings,
  EmailSettingsUpdate,
  EmailTemplate,
  HistoryEntry,
  SendEmailRequest,
  SendEmailResult,
  TemplateVariable,
} from '../models/email.model';

/** HTTP client for the local email server (server/). Proxied from /api by `ng serve`. */
@Injectable({ providedIn: 'root' })
export class EmailApiService {
  private readonly http = inject(HttpClient);

  getSettings(): Observable<EmailSettings> {
    return this.http.get<EmailSettings>('/api/settings');
  }

  saveSettings(update: EmailSettingsUpdate): Observable<EmailSettings> {
    return this.http.put<EmailSettings>('/api/settings', update);
  }

  verifySettings(): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>('/api/settings/verify', {});
  }

  getTemplates(): Observable<EmailTemplate[]> {
    return this.http.get<EmailTemplate[]>('/api/templates');
  }

  saveTemplates(templates: EmailTemplate[]): Observable<EmailTemplate[]> {
    return this.http.put<EmailTemplate[]>('/api/templates', templates);
  }

  getVariables(): Observable<TemplateVariable[]> {
    return this.http.get<TemplateVariable[]>('/api/variables');
  }

  saveVariables(variables: TemplateVariable[]): Observable<TemplateVariable[]> {
    return this.http.put<TemplateVariable[]>('/api/variables', variables);
  }

  send(message: SendEmailRequest): Observable<SendEmailResult> {
    return this.http.post<SendEmailResult>('/api/email/send', message);
  }

  getHistory(): Observable<HistoryEntry[]> {
    return this.http.get<HistoryEntry[]>('/api/history');
  }

  deleteHistoryEntry(id: string): Observable<void> {
    return this.http.delete<void>(`/api/history/${encodeURIComponent(id)}`);
  }

  /** Clears the history; with `testOnly` the real sends are kept. */
  clearHistory(testOnly: boolean): Observable<void> {
    return this.http.delete<void>('/api/history', { params: { testOnly } });
  }
}

/**
 * Maps an HTTP error to a translation key. Our server always answers errors with a JSON
 * `{ error }` body; a bare 0/500/502/503/504 comes from the dev proxy failing to reach it,
 * i.e. `npm run server` is not running.
 */
export function apiErrorKey(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const key = (error.error as ApiError | null)?.error;
    if (key) return key;
    if ([0, 500, 502, 503, 504].includes(error.status)) return 'EMAIL_ERRORS.SERVER_OFFLINE';
  }
  return 'EMAIL_ERRORS.SERVER_ERROR';
}

/** Technical detail from the server (e.g. the SMTP error), if any. */
export function apiErrorDetail(error: unknown): string | undefined {
  return error instanceof HttpErrorResponse ? (error.error as ApiError)?.detail : undefined;
}
