import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Lead } from '../../models/lead.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { isMobilePhone } from '../../utils/phone.utils';
import { downloadCsv, leadsToCsv } from '../../utils/csv.utils';

@Component({
  selector: 'app-lead-table',
  imports: [TranslatePipe],
  templateUrl: './lead-table.component.html',
  styleUrl: './lead-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadTableComponent {
  readonly leads = input.required<Lead[]>();
  /** Used to name the exported file (e.g. "leads-leiria.csv"). */
  readonly locality = input('');

  protected readonly isMobile = isMobilePhone;

  protected telHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }

  /** OSM websites sometimes lack the scheme ("www.example.pt"). */
  protected websiteHref(website: string): string {
    return /^https?:\/\//i.test(website) ? website : `https://${website}`;
  }

  protected exportCsv(): void {
    const slug = this.locality().toLowerCase().replace(/\s+/g, '-') || 'results';
    downloadCsv(leadsToCsv(this.leads()), `leads-${slug}.csv`);
  }
}
