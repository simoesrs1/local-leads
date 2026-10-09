import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EmailProvider, EmailSettingsUpdate } from '../../models/email.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { EmailApiService, apiErrorDetail, apiErrorKey } from '../../services/email-api.service';
import { EmailConfigService } from '../../services/email-config.service';
import { IconComponent } from '../icon/icon.component';
import { LoaderComponent } from '../loader/loader.component';

interface Preset {
  key: string;
  host: string;
  port: number;
  secure: boolean;
}

/** Common SMTP servers. */
const PRESETS: Preset[] = [
  { key: 'gmail', host: 'smtp.gmail.com', port: 465, secure: true },
  { key: 'office365', host: 'smtp.office365.com', port: 587, secure: false },
];

type Status = { kind: 'success' | 'error'; key: string; detail?: string } | null;

/** Secrets are write-only: the form starts them empty and an empty value keeps the stored one. */
const SECRET_FIELDS = ['password', 'googleClientSecret'] as const;

/**
 * Email settings: how to send (Google account via OAuth, or SMTP) and test mode.
 * Secrets and tokens live only on the local server; the browser never reads them back.
 */
@Component({
  selector: 'app-settings',
  imports: [FormsModule, IconComponent, LoaderComponent, TranslatePipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  protected readonly config = inject(EmailConfigService);
  private readonly api = inject(EmailApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly presets = PRESETS;
  protected readonly providers: EmailProvider[] = ['gmail', 'smtp'];
  protected readonly form = signal<EmailSettingsUpdate>({
    provider: 'gmail',
    googleClientId: '',
    googleClientSecret: '',
    host: '',
    port: 465,
    secure: true,
    user: '',
    password: '',
    fromName: '',
    fromEmail: '',
    testMode: true,
    testEmail: '',
  });
  protected readonly showPassword = signal(false);
  protected readonly busy = signal<'save' | 'verify' | 'google' | null>(null);
  protected readonly status = signal<Status>(null);
  protected readonly copied = signal(false);

  protected readonly saved = computed(() => this.config.settings());
  protected readonly dirty = computed(() => {
    const saved = this.saved();
    if (!saved) return false;
    const form = this.form();
    if (SECRET_FIELDS.some((field) => !!form[field])) return true;
    return (Object.keys(form) as (keyof EmailSettingsUpdate)[])
      .filter((key) => !(SECRET_FIELDS as readonly string[]).includes(key))
      .some((key) => form[key] !== saved[key as keyof typeof saved]);
  });
  /** Sender shown in test-mode hints: the Google account or the SMTP sender. */
  protected readonly senderAddress = computed(() =>
    this.form().provider === 'gmail' ? (this.saved()?.googleAccount ?? '') : this.form().fromEmail,
  );

  constructor() {
    this.handleOAuthResult();
    // Fill the form from the server whenever saved settings change.
    effect(() => {
      const saved = this.config.settings();
      if (!saved) return;
      const {
        hasPassword: _hasPassword,
        hasGoogleClientSecret: _hasSecret,
        googleAccount: _account,
        googleRedirectUri: _redirect,
        ...rest
      } = saved;
      untracked(() => this.form.set({ ...rest, password: '', googleClientSecret: '' }));
    });
  }

  /** Google redirects back to /settings?google=connected|error&reason=...&detail=... */
  private handleOAuthResult(): void {
    const params = this.route.snapshot.queryParamMap;
    const result = params.get('google');
    void this.config.load(!!result);
    if (!result) return;

    this.status.set(
      result === 'connected'
        ? { kind: 'success', key: 'SETTINGS.GOOGLE_CONNECTED' }
        : {
            kind: 'error',
            key: params.get('reason') ?? 'EMAIL_ERRORS.GOOGLE_CONNECT_FAILED',
            detail: params.get('detail') ?? undefined,
          },
    );
    // Drop the query string so a refresh does not show the message again.
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected patch(patch: Partial<EmailSettingsUpdate>): void {
    this.form.update((form) => ({ ...form, ...patch }));
    this.status.set(null);
  }

  protected applyPreset(preset: Preset): void {
    this.patch({ host: preset.host, port: preset.port, secure: preset.secure });
  }

  /** Port 465 implies implicit TLS; 587/25 use STARTTLS. Keep "secure" consistent when the port changes. */
  protected setPort(port: number): void {
    this.patch({ port, secure: port === 465 });
  }

  protected async copyRedirectUri(): Promise<void> {
    await navigator.clipboard?.writeText(this.saved()?.googleRedirectUri ?? '');
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  protected async save(): Promise<boolean> {
    this.busy.set('save');
    try {
      await this.config.saveSettings(this.form());
      this.status.set({ kind: 'success', key: 'SETTINGS.SAVED' });
      return true;
    } catch (error) {
      this.status.set({ kind: 'error', key: apiErrorKey(error), detail: apiErrorDetail(error) });
      return false;
    } finally {
      this.busy.set(null);
    }
  }

  /** Saves the client id/secret first, then leaves the app for Google's consent screen. */
  protected async connectGoogle(): Promise<void> {
    if (this.dirty() && !(await this.save())) return;
    if (!this.saved()?.googleClientId || !this.saved()?.hasGoogleClientSecret) {
      this.status.set({ kind: 'error', key: 'EMAIL_ERRORS.GOOGLE_CLIENT_MISSING' });
      return;
    }
    this.busy.set('google');
    this.config.connectGoogle();
  }

  protected async disconnectGoogle(): Promise<void> {
    this.busy.set('google');
    try {
      await this.config.disconnectGoogle();
      this.status.set({ kind: 'success', key: 'SETTINGS.GOOGLE_DISCONNECTED' });
    } catch (error) {
      this.status.set({ kind: 'error', key: apiErrorKey(error), detail: apiErrorDetail(error) });
    } finally {
      this.busy.set(null);
    }
  }

  /** Saves pending changes, then checks the connection (SMTP login or Google token). */
  protected async verify(): Promise<void> {
    if (this.dirty() && !(await this.save())) return;
    this.busy.set('verify');
    try {
      await firstValueFrom(this.api.verifySettings());
      this.status.set({ kind: 'success', key: 'SETTINGS.VERIFY_OK' });
    } catch (error) {
      this.status.set({ kind: 'error', key: apiErrorKey(error), detail: apiErrorDetail(error) });
    } finally {
      this.busy.set(null);
    }
  }
}
