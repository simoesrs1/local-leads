import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SendEmailResult } from '../../models/email.model';
import { Lead } from '../../models/lead.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { EmailApiService, apiErrorDetail, apiErrorKey } from '../../services/email-api.service';
import { EmailConfigService } from '../../services/email-config.service';
import { EmailHistoryService } from '../../services/email-history.service';
import { renderEmail } from '../../utils/template.utils';
import { IconComponent } from '../icon/icon.component';
import { LoaderComponent } from '../loader/loader.component';

/** Pause between emails so SMTP providers do not flag the batch as spam/abuse. */
const DELAY_BETWEEN_EMAILS_MS = 1500;

type Phase = 'compose' | 'sending' | 'done';

/**
 * Picks a template, previews it for every selected lead and sends the emails one by one
 * (with progress and a stop button). Test mode is shown here but enforced by the server.
 */
@Component({
  selector: 'app-email-composer',
  imports: [FormsModule, RouterLink, IconComponent, LoaderComponent, TranslatePipe],
  templateUrl: './email-composer.component.html',
  styleUrl: './email-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailComposerComponent {
  private readonly api = inject(EmailApiService);
  protected readonly config = inject(EmailConfigService);
  private readonly history = inject(EmailHistoryService);

  readonly leads = input.required<Lead[]>();
  /** Searched locality, used by the {{localidade}}-style variables. */
  readonly locality = input('');
  readonly finished = output<void>();

  protected readonly templateId = linkedSignal(() => this.config.templates()[0]?.id ?? '');
  protected readonly template = computed(() =>
    this.config.templates().find((template) => template.id === this.templateId()),
  );
  protected readonly testMode = computed(() => this.config.settings()?.testMode ?? true);
  protected readonly testAddress = computed(() => {
    const settings = this.config.settings();
    const sender = settings?.provider === 'gmail' ? settings.googleAccount : settings?.fromEmail;
    return settings?.testEmail || sender || '';
  });
  /** Gmail needs a connected Google account; SMTP needs a server and a sender. */
  protected readonly smtpReady = computed(() => {
    const settings = this.config.settings();
    if (!settings) return false;
    return settings.provider === 'gmail'
      ? !!settings.googleAccount
      : !!settings.host && !!settings.fromEmail;
  });

  /** One rendered email per selected lead. */
  protected readonly emails = computed(() => {
    const template = this.template();
    if (!template) return [];
    return this.leads().map((lead) =>
      renderEmail(template, this.config.variables(), lead, { locality: this.locality() }),
    );
  });

  /** Selected leads that already received a real email (from the send history). */
  protected readonly alreadyContacted = computed(
    () => this.emails().filter((email) => this.history.isContacted(email.lead)).length,
  );
  /** Live mode skips already-contacted leads unless the user unticks this. */
  protected readonly skipContacted = signal(true);

  /** In live mode, leads without an email address (or already contacted) are left out. */
  protected readonly sendable = computed(() => {
    if (this.testMode()) return this.emails();
    return this.emails().filter(
      (email) =>
        !!email.lead.email && !(this.skipContacted() && this.history.isContacted(email.lead)),
    );
  });
  /** Why the previewed email will not be sent (live mode only), or null. */
  protected readonly previewSkipReason = computed(() => {
    const email = this.preview();
    if (!email || this.testMode()) return null;
    if (!email.lead.email) return 'EMAIL.STATUS_SKIPPED';
    if (this.skipContacted() && this.history.isContacted(email.lead))
      return 'HISTORY.SKIPPED_CONTACTED';
    return null;
  });

  protected readonly withoutEmail = computed(
    () => this.emails().filter((email) => !email.lead.email).length,
  );
  protected readonly unknownKeys = computed(() => [
    ...new Set(this.emails().flatMap((email) => email.unknown)),
  ]);

  protected readonly previewIndex = linkedSignal({
    source: this.emails,
    computation: () => 0,
  });
  protected readonly preview = computed(() => this.emails()[this.previewIndex()]);

  /** Live sends need an explicit confirmation tick. */
  protected readonly confirmLive = signal(false);
  protected readonly phase = signal<Phase>('compose');
  protected readonly results = signal<SendEmailResult[]>([]);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly errorDetail = signal<string | undefined>(undefined);
  private stopRequested = false;

  protected readonly counts = computed(() => {
    const results = this.results();
    return {
      sent: results.filter((result) => result.status === 'sent').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
    };
  });

  protected readonly canSend = computed(
    () =>
      this.phase() === 'compose' &&
      this.smtpReady() &&
      !!this.template() &&
      this.sendable().length > 0 &&
      (this.testMode() || this.confirmLive()),
  );

  constructor() {
    void this.config.load();
    void this.history.load();
    // Stop the loop if the dialog is destroyed mid-batch.
    inject(DestroyRef).onDestroy(() => (this.stopRequested = true));
  }

  protected movePreview(step: number): void {
    const count = this.emails().length;
    this.previewIndex.update((index) => (index + step + count) % count);
  }

  /** "{{key}}" — built in code because braces inside template interpolations are ambiguous. */
  protected placeholder(key: string): string {
    return `{{${key}}}`;
  }

  protected leadName(leadId: string): string {
    return this.leads().find((lead) => lead.id === leadId)?.name ?? leadId;
  }

  protected stop(): void {
    this.stopRequested = true;
  }

  protected async send(): Promise<void> {
    if (!this.canSend()) return;
    this.phase.set('sending');
    this.results.set([]);
    this.errorKey.set(null);
    this.stopRequested = false;

    const queue = this.sendable();
    for (const [index, email] of queue.entries()) {
      if (this.stopRequested) break;
      try {
        const result = await firstValueFrom(
          this.api.send({
            leadId: email.lead.id,
            leadName: email.lead.name,
            to: email.lead.email,
            subject: email.subject,
            text: email.body,
            templateId: this.template()?.id,
            templateName: this.template()?.name,
          }),
        );
        this.results.update((results) => [...results, result]);
      } catch (error) {
        // Config/server problems affect every email: stop instead of failing each one.
        this.errorKey.set(apiErrorKey(error));
        this.errorDetail.set(apiErrorDetail(error));
        break;
      }
      if (index < queue.length - 1)
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_EMAILS_MS));
    }
    this.phase.set('done');
    // Refresh the "contacted" marks in the results table.
    void this.history.load(true);
  }
}
