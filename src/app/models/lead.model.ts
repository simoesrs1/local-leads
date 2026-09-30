/** Where a lead was sourced from. */
export type LeadSource = 'osm' | 'google';

/** A local business found by a search, normalised across data providers. */
export interface Lead {
  /** Provider-scoped unique id (e.g. `osm:node/123`, `google:ChIJ...`). */
  id: string;
  source: LeadSource;
  name: string;
  /** Human-readable business type (e.g. "Bakery", "Car repair"). */
  type: string;
  /** All phone numbers found (mobile and landline). */
  phones: string[];
  /** True when at least one phone is a mobile number. */
  hasMobile: boolean;
  email: string | null;
  website: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Link that opens the business on Google Maps. */
  mapsUrl: string;
}
