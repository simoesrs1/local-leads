import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { apiErrorKey } from '../../services/email-api.service';
import { EmailHistoryService } from '../../services/email-history.service';
import { TranslationService } from '../../services/translation.service';
import { normalizeText } from '../../utils/text.utils';
import { IconComponent } from '../icon/icon.component';
import { LoaderComponent } from '../loader/loader.component';

type ModeFilter = 'all' | 'live' | 'test';

/** List of every email sent (real and test), with filters and cleanup actions. */
@Component({
  selector: 'app-history',
  imports: [DatePipe, FormsModule, IconComponent, LoaderComponent, TranslatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryComponent {
  protected readonly history = inject(EmailHistoryService);
  private readonly translation = inject(TranslationService);

  protected readonly modes: ModeFilter[] = ['all', 'live', 'test'];
  protected readonly mode = signal<ModeFilter>('all');
  protected readonly text = signal('');
  protected readonly errorKey = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const text = normalizeText(this.text());
    return this.history.entries().filter((entry) => {
      if (this.mode() === 'live' && entry.testMode) return false;
      if (this.mode() === 'test' && !entry.testMode) return false;
      if (!text) return true;
      return normalizeText(
        `${entry.leadName} ${entry.leadEmail ?? ''} ${entry.to} ${entry.subject} ${entry.templateName ?? ''}`,
      ).includes(text);
    });
  });

  protected readonly counts = computed(() => {
    const entries = this.history.entries();
    const live = entries.filter((entry) => !entry.testMode);
    return {
      contacted: new Set(
        live.filter((entry) => entry.status === 'sent').map((entry) => entry.leadId),
      ).size,
      live: live.length,
      test: entries.length - live.length,
      failed: entries.filter((entry) => entry.status === 'failed').length,
    };
  });

  constructor() {
    void this.history.load(true);
  }

  protected async remove(id: string): Promise<void> {
    await this.run(() => this.history.remove(id));
  }

  protected async clear(testOnly: boolean): Promise<void> {
    const key = testOnly ? 'HISTORY.CONFIRM_CLEAR_TEST' : 'HISTORY.CONFIRM_CLEAR_ALL';
    if (!confirm(this.translation.translate(key))) return;
    await this.run(() => this.history.clear(testOnly));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.errorKey.set(null);
    try {
      await action();
    } catch (error) {
      this.errorKey.set(apiErrorKey(error));
    }
  }
}
