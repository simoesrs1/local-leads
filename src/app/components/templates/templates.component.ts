import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailTemplate } from '../../models/email.model';
import { Lead } from '../../models/lead.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { apiErrorKey } from '../../services/email-api.service';
import { EmailConfigService } from '../../services/email-config.service';
import { LeadSearchService } from '../../services/lead-search.service';
import { TranslationService } from '../../services/translation.service';
import { placeholdersIn, renderEmail } from '../../utils/template.utils';
import { IconComponent } from '../icon/icon.component';
import { LoaderComponent } from '../loader/loader.component';
import { ModalComponent } from '../modal/modal.component';
import { TemplateVariablesComponent } from '../template-variables/template-variables.component';

/** Used for the live preview when there are no search results yet. */
const SAMPLE_LEAD: Lead = {
  id: 'sample',
  source: 'osm',
  name: 'Padaria Central',
  type: 'Bakery',
  phones: ['244 123 456'],
  hasMobile: false,
  email: 'geral@padariacentral.pt',
  website: null,
  address: 'Rua Direita 5, 2400-000 Leiria',
  latitude: null,
  longitude: null,
  mapsUrl: '',
};

type Field = 'subject' | 'body';

/** Templates page: list, editor with variable insertion and a live preview. */
@Component({
  selector: 'app-templates',
  imports: [
    FormsModule,
    IconComponent,
    LoaderComponent,
    ModalComponent,
    TemplateVariablesComponent,
    TranslatePipe,
  ],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesComponent {
  protected readonly config = inject(EmailConfigService);
  private readonly search = inject(LeadSearchService);
  private readonly translation = inject(TranslationService);

  private readonly subjectInput = viewChild<ElementRef<HTMLInputElement>>('subjectInput');
  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');

  /** Local working copy; persisted only on "Save". */
  protected readonly drafts = signal<EmailTemplate[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() =>
    this.drafts().find((template) => template.id === this.selectedId()),
  );
  protected readonly dirty = computed(
    () => JSON.stringify(this.drafts()) !== JSON.stringify(this.config.templates()),
  );

  protected readonly variablesOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly savedAt = signal<Date | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  /** Field where variable chips insert their placeholder. */
  private lastField: Field = 'body';

  /** Preview with the first selected lead, else the first result, else a sample business. */
  protected readonly previewLead = computed(
    () => this.search.selectedLeads()[0] ?? this.search.leads()[0] ?? SAMPLE_LEAD,
  );
  protected readonly preview = computed(() => {
    const template = this.selected();
    if (!template) return null;
    return renderEmail(template, this.config.variables(), this.previewLead(), {
      locality: this.search.criteria()?.locality ?? 'Leiria',
    });
  });

  protected readonly unknownKeys = computed(() => {
    const template = this.selected();
    if (!template) return [];
    const known = new Set(this.config.variables().map((variable) => variable.key));
    return placeholdersIn(template.subject + '\n' + template.body).filter((key) => !known.has(key));
  });

  constructor() {
    void this.config.load();
    // Start the working copy from the server data once it arrives (and after saves).
    effect(() => {
      const templates = this.config.templates();
      untracked(() => {
        this.drafts.set(structuredClone(templates));
        if (!templates.some((template) => template.id === this.selectedId())) {
          this.selectedId.set(templates[0]?.id ?? null);
        }
      });
    });
  }

  protected placeholder(key: string): string {
    return `{{${key}}}`;
  }

  protected rememberField(field: Field): void {
    this.lastField = field;
  }

  protected update(patch: Partial<EmailTemplate>): void {
    const id = this.selectedId();
    this.drafts.update((templates) =>
      templates.map((template) => (template.id === id ? { ...template, ...patch } : template)),
    );
  }

  /** Inserts {{key}} at the cursor of the last focused field (subject or body). */
  protected insert(key: string): void {
    const template = this.selected();
    const element = (this.lastField === 'subject' ? this.subjectInput() : this.bodyInput())
      ?.nativeElement;
    if (!template || !element) return;

    const text = template[this.lastField];
    const start = element.selectionStart ?? text.length;
    const end = element.selectionEnd ?? text.length;
    const token = this.placeholder(key);
    this.update({ [this.lastField]: text.slice(0, start) + token + text.slice(end) });

    // Restore focus and put the cursor right after the inserted placeholder.
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  protected create(copyFrom?: EmailTemplate): void {
    const template: EmailTemplate = {
      id: crypto.randomUUID(),
      name: copyFrom ? `${copyFrom.name} (2)` : this.translation.translate('TEMPLATES.NEW_NAME'),
      subject: copyFrom?.subject ?? '',
      body: copyFrom?.body ?? '',
      updatedAt: new Date().toISOString(),
    };
    this.drafts.update((templates) => [...templates, template]);
    this.selectedId.set(template.id);
  }

  protected remove(): void {
    const id = this.selectedId();
    this.drafts.update((templates) => templates.filter((template) => template.id !== id));
    this.selectedId.set(this.drafts()[0]?.id ?? null);
  }

  protected discard(): void {
    this.drafts.set(structuredClone(this.config.templates()));
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.errorKey.set(null);
    try {
      const saved = this.config.templates();
      const now = new Date().toISOString();
      // Only templates that actually changed get a new timestamp.
      await this.config.saveTemplates(
        this.drafts().map((draft) => {
          const before = saved.find((template) => template.id === draft.id);
          return JSON.stringify(before) === JSON.stringify(draft)
            ? draft
            : { ...draft, updatedAt: now };
        }),
      );
      this.savedAt.set(new Date());
    } catch (error) {
      this.errorKey.set(apiErrorKey(error));
    } finally {
      this.saving.set(false);
    }
  }
}
