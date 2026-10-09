import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HistoryEntry } from '../models/email.model';
import { Lead } from '../models/lead.model';
import { buildContactIndex, lastContact } from '../utils/history.utils';
import { EmailApiService, apiErrorKey } from './email-api.service';

/** Send history from the email server, plus fast "was this lead already contacted?" lookups. */
@Injectable({ providedIn: 'root' })
export class EmailHistoryService {
  private readonly api = inject(EmailApiService);
  private loading: Promise<void> | null = null;

  readonly entries = signal<HistoryEntry[]>([]);
  readonly loaded = signal(false);
  readonly loadErrorKey = signal<string | null>(null);
  private readonly index = computed(() => buildContactIndex(this.entries()));

  /** Loads once; pass `force` after sending to refresh. Fails silently (no server = no history). */
  load(force = false): Promise<void> {
    if (!this.loading || force) {
      this.loading = firstValueFrom(this.api.getHistory())
        .then((entries) => {
          this.entries.set(entries);
          this.loaded.set(true);
          this.loadErrorKey.set(null);
        })
        .catch((error) => {
          this.loadErrorKey.set(apiErrorKey(error));
          this.loading = null;
        });
    }
    return this.loading;
  }

  /** Last real email sent to this business, if any. */
  lastContact(lead: Lead): HistoryEntry | undefined {
    return lastContact(this.index(), lead);
  }

  isContacted = (lead: Lead): boolean => !!this.lastContact(lead);

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteHistoryEntry(id));
    this.entries.update((entries) => entries.filter((entry) => entry.id !== id));
  }

  async clear(testOnly: boolean): Promise<void> {
    await firstValueFrom(this.api.clearHistory(testOnly));
    this.entries.update((entries) => (testOnly ? entries.filter((entry) => !entry.testMode) : []));
  }
}
