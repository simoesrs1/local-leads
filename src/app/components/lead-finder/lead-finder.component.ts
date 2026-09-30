import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LeadFilters } from '../../models/filter.model';
import { SearchCriteria } from '../../models/search.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LeadSearchService } from '../../services/lead-search.service';
import { LeadFiltersComponent } from '../lead-filters/lead-filters.component';
import { LeadStatsComponent } from '../lead-stats/lead-stats.component';
import { LeadTableComponent } from '../lead-table/lead-table.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';

/** Page container: wires the presentational components to LeadSearchService. */
@Component({
  selector: 'app-lead-finder',
  imports: [
    SearchBarComponent,
    LeadFiltersComponent,
    LeadStatsComponent,
    LeadTableComponent,
    TranslatePipe,
  ],
  templateUrl: './lead-finder.component.html',
  styleUrl: './lead-finder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadFinderComponent {
  protected readonly store = inject(LeadSearchService);

  protected onSearch(criteria: SearchCriteria): void {
    this.store.search(criteria);
  }

  protected onFiltersChange(patch: Partial<LeadFilters>): void {
    this.store.updateFilters(patch);
  }

  /** Stat tiles replace the current filters with a single shortcut filter (null = show all). */
  protected onStatClick(patch: Partial<LeadFilters> | null): void {
    this.store.resetFilters();
    if (patch) this.store.updateFilters(patch);
  }
}
