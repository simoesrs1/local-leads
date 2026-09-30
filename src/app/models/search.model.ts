import { LeadSource } from './lead.model';

/** Business groups the user can search for. Each provider maps them to its own query. */
export const BUSINESS_CATEGORIES = [
  'shops',
  'food',
  'health',
  'beauty',
  'services',
  'accommodation',
  'fitness',
  'automotive',
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export interface SearchCriteria {
  /** Free-text locality, e.g. "Leiria". */
  locality: string;
  categories: BusinessCategory[];
  radiusKm: number;
  source: LeadSource;
}

/** Result of geocoding a locality. */
export interface GeoLocation {
  displayName: string;
  latitude: number;
  longitude: number;
}
