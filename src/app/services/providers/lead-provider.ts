import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Lead, LeadSource } from '../../models/lead.model';
import { GeoLocation, SearchCriteria } from '../../models/search.model';

/** Contract every data source implements. Add a new source by providing another LEAD_PROVIDERS entry. */
export interface LeadProvider {
  readonly source: LeadSource;
  /** False when the provider cannot be used (e.g. missing API key). */
  readonly available: boolean;
  search(location: GeoLocation, criteria: SearchCriteria): Observable<Lead[]>;
}

export const LEAD_PROVIDERS = new InjectionToken<LeadProvider[]>('LEAD_PROVIDERS');
