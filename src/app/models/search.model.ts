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
  /** Known coordinates (e.g. from browser geolocation); when set, the locality is not geocoded. */
  center?: { latitude: number; longitude: number };
}

/** Defaults used by the search bar and by searches started from a link. */
export const DEFAULT_RADIUS_KM = 2;
export const DEFAULT_SOURCE: LeadSource = 'osm';

/** Result of geocoding a locality. */
export interface GeoLocation {
  displayName: string;
  latitude: number;
  longitude: number;
}
