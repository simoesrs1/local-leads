import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { LEAD_FIELDS, LeadField, TemplateVariable } from '../../models/email.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { apiErrorKey } from '../../services/email-api.service';
import { EmailConfigService } from '../../services/email-config.service';
import { isValidKey, placeholdersIn, slugifyKey } from '../../utils/template.utils';
import { IconComponent } from '../icon/icon.component';

interface VariableRow extends TemplateVariable {
  /** Stable id for @for tracking while keys are being edited. */
  rowId: number;
  /** True once the user edits the key by hand; until then it follows the label. */
  keyTouched: boolean;
  /** Key when the dialog opened, to warn about templates that still use it. */
  originalKey: string | null;
}

/**
 * Editor for template variables: a label ("Nome Cliente") becomes a key ({{nome_cliente}})
 * bound to a lead field or to a fixed text. Edits are local until "Save".
 */
@Component({
  selector: 'app-template-variables',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './template-variables.component.html',
  styleUrl: './template-variables.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateVariablesComponent {
  private readonly config = inject(EmailConfigService);
  readonly finished = output<void>();

  protected readonly fields = LEAD_FIELDS;
  private nextRowId = 0;

  protected readonly rows = signal<VariableRow[]>(
    this.config.variables().map((variable) => ({
      ...variable,
      rowId: this.nextRowId++,
      keyTouched: true,
      originalKey: variable.key,
    })),
  );

  /** Keys used by any saved template (to warn before renaming/removing them). */
  private readonly usedKeys = computed(
    () =>
      new Set(
        this.config
          .templates()
          .flatMap((template) => placeholdersIn(template.subject + template.body)),
      ),
  );

  protected readonly errors = computed(() => {
    const seen = new Map<string, number>();
    for (const row of this.rows()) seen.set(row.key, (seen.get(row.key) ?? 0) + 1);
    return new Map(
      this.rows().map((row) => [
        row.rowId,
        !row.label.trim()
          ? 'VARIABLES.ERROR_LABEL'
          : !isValidKey(row.key)
            ? 'VARIABLES.ERROR_KEY'
            : (seen.get(row.key) ?? 0) > 1
              ? 'VARIABLES.ERROR_DUPLICATE'
              : null,
      ]),
    );
  });

  protected readonly hasErrors = computed(() => [...this.errors().values()].some(Boolean));
  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  /** Templates still referencing a key that was renamed or removed. */
  protected readonly orphanedKeys = computed(() => {
    const current = new Set(this.rows().map((row) => row.key));
    return [...this.usedKeys()].filter(
      (key) =>
        !current.has(key) && this.config.variables().some((variable) => variable.key === key),
    );
  });

  // Native [value]/(input) bindings instead of ngModel: ngModel writes its initial value
  // asynchronously, which could wipe what is typed right after a row is added.
  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected placeholder(key: string): string {
    return `{{${key}}}`;
  }

  protected add(): void {
    this.rows.update((rows) => [
      ...rows,
      {
        label: '',
        key: '',
        source: 'custom',
        value: '',
        rowId: this.nextRowId++,
        keyTouched: false,
        originalKey: null,
      },
    ]);
  }

  protected remove(rowId: number): void {
    this.rows.update((rows) => rows.filter((row) => row.rowId !== rowId));
  }

  protected update(rowId: number, patch: Partial<VariableRow>): void {
    this.rows.update((rows) =>
      rows.map((row) => {
        if (row.rowId !== rowId) return row;
        const next = { ...row, ...patch };
        // New variables: the key follows the label until edited manually.
        if (patch.label !== undefined && !row.keyTouched) next.key = slugifyKey(patch.label);
        if (patch.key !== undefined) next.keyTouched = true;
        return next;
      }),
    );
  }

  protected setSource(rowId: number, source: string): void {
    this.update(rowId, { source: source as LeadField | 'custom' });
  }

  protected async save(): Promise<void> {
    if (this.hasErrors()) return;
    this.saving.set(true);
    this.errorKey.set(null);
    try {
      await this.config.saveVariables(
        this.rows().map(({ label, key, source, value }) => ({
          label: label.trim(),
          key,
          source,
          value: source === 'custom' ? value : '',
        })),
      );
      this.finished.emit();
    } catch (error) {
      this.errorKey.set(apiErrorKey(error));
    } finally {
      this.saving.set(false);
    }
  }
}
