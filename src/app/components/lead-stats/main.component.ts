import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LeadFilters } from '../../models/filter.model';
import { LeadStats } from '../../models/stats.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Summary tiles. Clicking a tile applies the matching filter as a shortcut. */
@Component({
  selector: 'app-lead-stats',
  imports: [TranslatePipe],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadStatsComponent {
  readonly stats = input.required<LeadStats>();
  readonly applyFilter = output<Partial<LeadFilters> | null>();
}
