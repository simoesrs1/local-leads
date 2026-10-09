import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeadFilters } from '../../models/filter.model';
import { SearchCriteria } from '../../models/search.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LeadSearchService } from '../../services/lead-search.service';
import { criteriaFromParams } from '../../utils/search-params.utils';
import { EmailComposerComponent } from '../email-composer/email-composer.component';
import { IconComponent } from '../icon/icon.component';
import { LeadFiltersComponent } from '../lead-filters/lead-filters.component';
import { LeadStatsComponent } from '../lead-stats/lead-stats.component';
import { LeadTableComponent } from '../lead-table/lead-table.component';
import { LoaderComponent } from '../loader/loader.component';
import { ModalComponent } from '../modal/modal.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';

/** Page container: wires the presentational components to LeadSearchService. */
@Component({
  selector: 'app-lead-finder',
  imports: [
    SearchBarComponent,
    LeadFiltersComponent,
    LeadStatsComponent,
    LeadTableComponent,
    LoaderComponent,
    ModalComponent,
    EmailComposerComponent,
    IconComponent,
    TranslatePipe,
  ],
  templateUrl: './lead-finder.component.html',
  styleUrl: './lead-finder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadFinderComponent {
  protected readonly store = inject(LeadSearchService);
  private readonly route = inject(ActivatedRoute);

  protected readonly composerOpen = signal(false);
  protected readonly selectedWithEmail = computed(
    () => this.store.selectedLeads().filter((lead) => !!lead.email).length,
  );

  constructor() {
    // A link like /search?locality=...&lat=...&lon=... (e.g. from the home page) starts the search directly.
    const criteria = criteriaFromParams(this.route.snapshot.queryParams);
    const current = this.store.criteria();
    // Coming back to the same link keeps the existing results instead of searching again.
    const alreadyLoaded =
      current?.locality === criteria?.locality &&
      current?.center?.latitude === criteria?.center?.latitude &&
      current?.center?.longitude === criteria?.center?.longitude;
    if (criteria && !alreadyLoaded) this.store.search(criteria);
  }

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
