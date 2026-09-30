import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DEFAULT_FILTERS, LeadFilters } from '../../models/filter.model';
import { LeadStats } from '../../models/stats.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent, IconName } from '../icon/icon.component';

interface StatTile {
  key: keyof LeadStats;
  icon: IconName;
  label: string;
  /** Filter applied when the tile is clicked (null = clear contact filters). */
  patch: Partial<LeadFilters> | null;
}

/** Contact-related filter fields that the tiles toggle. */
const CONTACT_FIELDS = ['phone', 'email', 'website', 'noContactData'] as const;

/** Summary tiles. Clicking a tile applies the matching filter as a shortcut. */
@Component({
  selector: 'app-lead-stats',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './lead-stats.component.html',
  styleUrl: './lead-stats.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadStatsComponent {
  readonly stats = input.required<LeadStats>();
  /** Current filters, used to highlight the tile that matches them. */
  readonly filters = input<LeadFilters>(DEFAULT_FILTERS);
  readonly applyFilter = output<Partial<LeadFilters> | null>();

  protected readonly tiles: StatTile[] = [
    { key: 'total', icon: 'store', label: 'STATS.TOTAL', patch: null },
    {
      key: 'withoutPhone',
      icon: 'phone',
      label: 'STATS.WITHOUT_PHONE',
      patch: { phone: 'without' },
    },
    {
      key: 'withoutEmail',
      icon: 'mail',
      label: 'STATS.WITHOUT_EMAIL',
      patch: { email: 'without' },
    },
    {
      key: 'withoutWebsite',
      icon: 'globe',
      label: 'STATS.WITHOUT_WEBSITE',
      patch: { website: 'without' },
    },
    {
      key: 'withoutContactData',
      icon: 'userX',
      label: 'STATS.WITHOUT_CONTACT_DATA',
      patch: { noContactData: true },
    },
  ];

  protected isActive(tile: StatTile): boolean {
    const expected = { ...DEFAULT_FILTERS, ...tile.patch };
    return CONTACT_FIELDS.every((field) => this.filters()[field] === expected[field]);
  }

  /** Share of the total, used for the small bar under each number. */
  protected share(tile: StatTile): number {
    const total = this.stats().total;
    return total ? Math.round((this.stats()[tile.key] / total) * 100) : 0;
  }
}
