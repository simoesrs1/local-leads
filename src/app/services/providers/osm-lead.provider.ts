import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Lead } from '../../models/lead.model';
import { BusinessCategory, GeoLocation, SearchCriteria } from '../../models/search.model';
import { isMobilePhone, splitPhones } from '../../utils/phone.utils';
import { buildMapsUrl, humanize } from '../../utils/text.utils';
import { LeadSearchError } from '../lead-search.error';
import { LeadProvider } from './lead-provider';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** Overpass tag selectors per category. Every selector also requires a `name` tag. */
const CATEGORY_SELECTORS: Record<BusinessCategory, string[]> = {
  shops: ['["shop"]'],
  food: ['["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|food_court)$"]'],
  health: ['["amenity"~"^(pharmacy|dentist|doctors|clinic|veterinary)$"]', '["healthcare"]'],
  beauty: ['["shop"~"^(hairdresser|beauty|cosmetics|massage|tattoo)$"]'],
  services: ['["office"]', '["craft"]'],
  accommodation: ['["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]'],
  fitness: ['["leisure"~"^(fitness_centre|sports_centre|dance)$"]'],
  automotive: [
    '["shop"~"^(car|car_repair|car_parts|tyres|motorcycle)$"]',
    '["amenity"="car_wash"]',
  ],
};

/** Tag keys checked (in order) to derive a business type label. */
const TYPE_KEYS = ['shop', 'amenity', 'healthcare', 'office', 'craft', 'tourism', 'leisure'];

/** Builds the Overpass QL query for the selected categories around a point. */
export function buildOverpassQuery(location: GeoLocation, criteria: SearchCriteria): string {
  const around = `(around:${Math.round(criteria.radiusKm * 1000)},${location.latitude},${location.longitude})`;
  const selectors = new Set(
    criteria.categories.flatMap((category) => CATEGORY_SELECTORS[category]),
  );
  const statements = [...selectors]
    .map((selector) => `  nwr${selector}["name"]${around};`)
    .join('\n');
  // `out center tags` returns a centre point for ways/relations so every lead has coordinates.
  return `[out:json][timeout:60];\n(\n${statements}\n);\nout center tags;`;
}

/** Maps a raw Overpass element to a Lead. Exported for unit tests. */
export function mapOverpassElement(element: OverpassElement): Lead | null {
  const tags = element.tags ?? {};
  if (!tags['name']) return null;

  const phones = splitPhones(
    tags['phone'],
    tags['contact:phone'],
    tags['mobile'],
    tags['contact:mobile'],
  );
  const latitude = element.lat ?? element.center?.lat ?? null;
  const longitude = element.lon ?? element.center?.lon ?? null;
  const address = buildAddress(tags);
  const typeKey = TYPE_KEYS.find((key) => tags[key]);
  const typeValue = typeKey ? tags[typeKey] : '';

  return {
    id: `osm:${element.type}/${element.id}`,
    source: 'osm',
    name: tags['name'],
    // Generic values like office=yes / craft=yes fall back to the tag key itself.
    type: humanize(typeValue && typeValue !== 'yes' ? typeValue : (typeKey ?? 'business')),
    phones,
    hasMobile: phones.some(isMobilePhone),
    email: firstValue(tags['email'] ?? tags['contact:email']),
    website: firstValue(tags['website'] ?? tags['contact:website'] ?? tags['url']),
    address,
    latitude,
    longitude,
    mapsUrl: buildMapsUrl(tags['name'], address, latitude, longitude),
  };
}

function buildAddress(tags: Record<string, string>): string | null {
  if (tags['addr:full']) return tags['addr:full'];
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || null;
}

/** OSM allows `;`-separated values; keep only the first one. */
function firstValue(value: string | undefined): string | null {
  return value?.split(';')[0].trim() || null;
}

/** Free provider backed by OpenStreetMap's Overpass API. Coverage of emails/phones depends on the community. */
@Injectable({ providedIn: 'root' })
export class OsmLeadProvider implements LeadProvider {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'https://overpass-api.de/api/interpreter';

  readonly source = 'osm' as const;
  readonly available = true;

  search(location: GeoLocation, criteria: SearchCriteria): Observable<Lead[]> {
    const body = `data=${encodeURIComponent(buildOverpassQuery(location, criteria))}`;
    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });

    return this.http.post<OverpassResponse>(this.endpoint, body, { headers }).pipe(
      catchError((error) =>
        throwError(
          () =>
            // 429 = rate limited, 504 = server busy: both mean "try again later".
            new LeadSearchError(
              [429, 504].includes(error?.status)
                ? 'ERRORS.PROVIDER_BUSY'
                : 'ERRORS.PROVIDER_FAILED',
              error,
            ),
        ),
      ),
      map((response) =>
        response.elements.map(mapOverpassElement).filter((lead): lead is Lead => lead !== null),
      ),
    );
  }
}
