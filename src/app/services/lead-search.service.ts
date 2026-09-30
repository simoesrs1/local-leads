import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, switchMap } from 'rxjs';
import { DEFAULT_FILTERS, LeadFilters } from '../models/filter.model';
import { Lead, LeadSource } from '../models/lead.model';
import { GeoLocation, SearchCriteria } from '../models/search.model';
import { LeadStats } from '../models/stats.model';
import { filterLeads } from '../utils/lead-filter.utils';
import { GeocodingService } from './geocoding.service';
import { LeadSearchError } from './lead-search.error';
import { LEAD_PROVIDERS } from './providers/lead-provider';

/** Holds search state (results, filters, loading, errors) as signals for the whole app. */
@Injectable({ providedIn: 'root' })
export class LeadSearchService {
  private readonly geocoding = inject(GeocodingService);
  private readonly providers = inject(LEAD_PROVIDERS);
  private searchSubscription?: Subscription;

  private readonly _leads = signal<Lead[]>([]);
  private readonly _loading = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _location = signal<GeoLocation | null>(null);
  private readonly _criteria = signal<SearchCriteria | null>(null);

  readonly leads = this._leads.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly location = this._location.asReadonly();
  readonly criteria = this._criteria.asReadonly();
  readonly filters = signal<LeadFilters>({ ...DEFAULT_FILTERS });

  readonly filteredLeads = computed(() => filterLeads(this._leads(), this.filters()));

  /** Distinct business types in the current results, for the type filter dropdown. */
  readonly types = computed(() =>
    [...new Set(this._leads().map((lead) => lead.type))].sort((a, b) => a.localeCompare(b)),
  );

  /** Counters shown above the results. */
  readonly stats = computed<LeadStats>(() => {
    const leads = this._leads();
    return {
      total: leads.length,
      withoutPhone: leads.filter((lead) => lead.phones.length === 0).length,
      withoutEmail: leads.filter((lead) => !lead.email).length,
      withoutWebsite: leads.filter((lead) => !lead.website).length,
      withoutContactData: leads.filter(
        (lead) => !lead.phones.length && !lead.email && !lead.website,
      ).length,
    };
  });

  /** Sources that can be selected in the UI. */
  readonly availableSources: LeadSource[] = this.providers
    .filter((provider) => provider.available)
    .map((provider) => provider.source);

  search(criteria: SearchCriteria): void {
    const provider = this.providers.find((candidate) => candidate.source === criteria.source);
    if (!provider) {
      this._errorKey.set('ERRORS.GENERIC');
      return;
    }

    // Cancel any in-flight search so older responses never overwrite newer ones.
    this.searchSubscription?.unsubscribe();
    this._criteria.set(criteria);
    this._loading.set(true);
    this._errorKey.set(null);
    this._leads.set([]);
    this._location.set(null);
    this.filters.set({ ...DEFAULT_FILTERS });

    this.searchSubscription = this.geocoding
      .geocode(criteria.locality)
      .pipe(
        switchMap((location) => {
          this._location.set(location);
          return provider.search(location, criteria);
        }),
      )
      .subscribe({
        next: (leads) => {
          this._leads.set(dedupeAndSort(leads));
          this._loading.set(false);
        },
        error: (error: unknown) => {
          // Keep the underlying cause visible in DevTools for troubleshooting.
          console.error('[LeadSearch]', error);
          this._errorKey.set(
            error instanceof LeadSearchError ? error.translationKey : 'ERRORS.GENERIC',
          );
          this._loading.set(false);
        },
      });
  }

  updateFilters(patch: Partial<LeadFilters>): void {
    this.filters.update((filters) => ({ ...filters, ...patch }));
  }

  resetFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
  }
}

/** Removes duplicates (same id, or same name + address from overlapping categories) and sorts by name. */
function dedupeAndSort(leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  return leads
    .filter((lead) => {
      const key = `${lead.name.toLowerCase()}|${(lead.address ?? lead.id).toLowerCase()}`;
      if (seen.has(lead.id) || seen.has(key)) return false;
      seen.add(lead.id);
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
