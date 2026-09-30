import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DEFAULT_FILTERS,
  LeadFilters,
  PhoneFilter,
  PresenceFilter,
} from '../../models/filter.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-lead-filters',
  imports: [FormsModule, IconComponent, TranslatePipe],
  templateUrl: './lead-filters.component.html',
  styleUrl: './lead-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadFiltersComponent {
  readonly filters = input.required<LeadFilters>();
  /** Business types present in the current results. */
  readonly types = input<string[]>([]);
  readonly filtersChange = output<Partial<LeadFilters>>();
  readonly reset = output<void>();

  protected readonly presenceOptions: PresenceFilter[] = ['any', 'with', 'without'];
  protected readonly phoneOptions: PhoneFilter[] = ['any', 'with', 'without', 'withoutMobile'];

  /** Number of filters that differ from the defaults, shown as a badge. */
  protected readonly activeCount = computed(() => {
    const filters = this.filters();
    return (Object.keys(DEFAULT_FILTERS) as (keyof LeadFilters)[]).filter(
      (key) => filters[key] !== DEFAULT_FILTERS[key],
    ).length;
  });
}
