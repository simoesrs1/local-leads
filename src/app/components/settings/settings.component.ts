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
import { firstValueFrom } from 'rxjs';
import { EmailSettingsUpdate } from '../../models/email.model';
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

/** Common SMTP servers; "custom" leaves the fields as they are. */
const PRESETS: Preset[] = [
  { key: 'gmail', host: 'smtp.gmail.com', port: 465, secure: true },
  { key: 'office365', host: 'smtp.office365.com', port: 587, secure: false },
];

type Status = { kind: 'success' | 'error'; key: string; detail?: string } | null;

/**
 * Email settings: SMTP account (sensitive, stored only on the local server) and test mode.
 * The password is write-only: the server only tells us whether one is stored.
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

  protected readonly presets = PRESETS;
  protected readonly form = signal<EmailSettingsUpdate>({
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
  protected readonly busy = signal<'save' | 'verify' | null>(null);
  protected readonly status = signal<Status>(null);

  protected readonly hasStoredPassword = computed(
    () => this.config.settings()?.hasPassword ?? false,
  );
  protected readonly dirty = computed(() => {
    const saved = this.config.settings();
    if (!saved) return false;
    const { password, ...form } = this.form();
    return (
      !!password ||
      (Object.keys(form) as (keyof typeof form)[]).some((key) => form[key] !== saved[key])
    );
  });

  constructor() {
    void this.config.load();
    // Fill the form from the server whenever saved settings change.
    effect(() => {
      const saved = this.config.settings();
      if (!saved) return;
      const { hasPassword: _hasPassword, ...rest } = saved;
      untracked(() => this.form.set({ ...rest, password: '' }));
    });
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

  /** Saves pending changes, then asks the server to log in to the SMTP server. */
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
