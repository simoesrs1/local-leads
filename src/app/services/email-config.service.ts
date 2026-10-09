import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  EmailSettings,
  EmailSettingsUpdate,
  EmailTemplate,
  TemplateVariable,
} from '../models/email.model';
import { EmailApiService, apiErrorKey } from './email-api.service';

/** Cached email settings, templates and variables shared by every page, as signals. */
@Injectable({ providedIn: 'root' })
export class EmailConfigService {
  private readonly api = inject(EmailApiService);
  private loading: Promise<void> | null = null;

  readonly settings = signal<EmailSettings | null>(null);
  readonly templates = signal<EmailTemplate[]>([]);
  readonly variables = signal<TemplateVariable[]>([]);
  /** Translation key of the last load error (e.g. server offline), or null. */
  readonly loadErrorKey = signal<string | null>(null);

  /** Loads everything once; call again with `force` to refresh. */
  load(force = false): Promise<void> {
    if (!this.loading || force) {
      this.loading = this.fetchAll().catch((error) => {
        this.loadErrorKey.set(apiErrorKey(error));
        this.loading = null; // allow a retry
      });
    }
    return this.loading;
  }

  async saveSettings(update: EmailSettingsUpdate): Promise<void> {
    this.settings.set(await firstValueFrom(this.api.saveSettings(update)));
  }

  async saveTemplates(templates: EmailTemplate[]): Promise<void> {
    this.templates.set(await firstValueFrom(this.api.saveTemplates(templates)));
  }

  async saveVariables(variables: TemplateVariable[]): Promise<void> {
    this.variables.set(await firstValueFrom(this.api.saveVariables(variables)));
  }

  private async fetchAll(): Promise<void> {
    const [settings, templates, variables] = await Promise.all([
      firstValueFrom(this.api.getSettings()),
      firstValueFrom(this.api.getTemplates()),
      firstValueFrom(this.api.getVariables()),
    ]);
    this.settings.set(settings);
    this.templates.set(templates);
    this.variables.set(variables);
    this.loadErrorKey.set(null);
  }
}
