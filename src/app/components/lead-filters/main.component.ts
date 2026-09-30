import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeadFilters, PhoneFilter, PresenceFilter } from '../../models/filter.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-lead-filters',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
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
}
