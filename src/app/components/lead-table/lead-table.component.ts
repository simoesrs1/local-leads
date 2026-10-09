import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Lead } from '../../models/lead.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { isMobilePhone } from '../../utils/phone.utils';
import { downloadCsv, leadsToCsv } from '../../utils/csv.utils';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-lead-table',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './lead-table.component.html',
  styleUrl: './lead-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadTableComponent {
  readonly leads = input.required<Lead[]>();
  /** Used to name the exported file (e.g. "leads-leiria.csv"). */
  readonly locality = input('');
  /** Ids of the selected leads (multi-select for bulk email). */
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly toggle = output<string>();
  readonly toggleAll = output<{ ids: string[]; selected: boolean }>();

  /** How many of the visible leads are selected: drives the header checkbox (checked/indeterminate). */
  protected readonly visibleSelected = computed(
    () => this.leads().filter((lead) => this.selectedIds().has(lead.id)).length,
  );

  protected onToggleAll(): void {
    const allSelected = this.visibleSelected() === this.leads().length;
    this.toggleAll.emit({ ids: this.leads().map((lead) => lead.id), selected: !allSelected });
  }

  protected readonly isMobile = isMobilePhone;

  protected telHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }

  /** OSM websites sometimes lack the scheme ("www.example.pt"). */
  protected websiteHref(website: string): string {
    return /^https?:\/\//i.test(website) ? website : `https://${website}`;
  }

  /** Shows "example.pt" instead of "https://www.example.pt/". */
  protected hostname(website: string): string {
    try {
      return new URL(this.websiteHref(website)).hostname.replace(/^www\./, '');
    } catch {
      return website;
    }
  }

  /** Up to two initials for the avatar ("Padaria Central" -> "PC"). */
  protected initials(name: string): string {
    const words = name.split(/\s+/).filter((word) => /^[\p{L}\d]/u.test(word));
    return words
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
  }

  /** Stable per-name hue so the same business always gets the same avatar colour. */
  protected avatarHue(name: string): number {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
  }

  protected exportCsv(): void {
    const slug = this.locality().toLowerCase().replace(/\s+/g, '-') || 'results';
    downloadCsv(leadsToCsv(this.leads()), `leads-${slug}.csv`);
  }
}
