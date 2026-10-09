import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, expand, forkJoin, map, reduce, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Lead } from '../../models/lead.model';
import { BusinessCategory, GeoLocation, SearchCriteria } from '../../models/search.model';
import { isMobilePhone } from '../../utils/phone.utils';
import { LeadSearchError } from '../lead-search.error';
import { LeadProvider } from './lead-provider';

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text: string };
  location?: { latitude: number; longitude: number };
}

interface SearchTextResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}

/** Text used in the Places text search for each category ("<query> in <locality>"). */
const CATEGORY_QUERIES: Record<BusinessCategory, string> = {
  shops: 'shops',
  food: 'restaurants and cafes',
  health: 'clinics and pharmacies',
  beauty: 'hair and beauty salons',
  services: 'professional services',
  accommodation: 'hotels and guest houses',
  fitness: 'gyms',
  automotive: 'car repair and car dealers',
};

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.primaryTypeDisplayName',
  'places.location',
  'nextPageToken',
].join(',');

/** Google returns at most 20 results per page and 3 pages per query. */
const MAX_PAGES = 3;

/** Maps a Places API (New) result to a Lead. Google never exposes emails. */
export function mapGooglePlace(place: GooglePlace): Lead {
  const phone = place.internationalPhoneNumber ?? place.nationalPhoneNumber;
  const phones = phone ? [phone] : [];
  const name = place.displayName?.text ?? '';
  return {
    id: `google:${place.id}`,
    source: 'google',
    name,
    type: place.primaryTypeDisplayName?.text ?? 'Business',
    phones,
    hasMobile: phones.some(isMobilePhone),
    email: null,
    website: place.websiteUri ?? null,
    address: place.formattedAddress ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
  };
}

/** Optional provider backed by Google Places API (New). Needs `environment.googlePlacesApiKey`. */
@Injectable({ providedIn: 'root' })
export class GooglePlacesLeadProvider implements LeadProvider {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'https://places.googleapis.com/v1/places:searchText';
  private readonly apiKey = environment.googlePlacesApiKey;

  readonly source = 'google' as const;
  readonly available = !!this.apiKey;

  search(location: GeoLocation, criteria: SearchCriteria): Observable<Lead[]> {
    if (!this.available) return throwError(() => new LeadSearchError('ERRORS.GOOGLE_KEY_MISSING'));

    // One text search per category, run in parallel.
    // A free-text sector is a single query ("pedreiros in Leiria"); otherwise one per category.
    const sector = criteria.sector?.trim();
    const queries = sector
      ? [sector]
      : criteria.categories.map((category) => CATEGORY_QUERIES[category]);
    const requests = queries.map((query) => this.searchCategory(query, location, criteria));
    return forkJoin(requests).pipe(map((pages) => pages.flat()));
  }

  private searchCategory(
    query: string,
    location: GeoLocation,
    criteria: SearchCriteria,
  ): Observable<Lead[]> {
    const headers = new HttpHeaders({
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    });
    const request = (pageToken?: string) =>
      this.http.post<SearchTextResponse>(
        this.endpoint,
        {
          textQuery: `${query} in ${criteria.locality}`,
          pageSize: 20,
          pageToken,
          // Bias results around the geocoded locality (Google caps the radius at 50 km).
          locationBias: {
            circle: {
              center: { latitude: location.latitude, longitude: location.longitude },
              radius: Math.min(criteria.radiusKm * 1000, 50000),
            },
          },
        },
        { headers },
      );

    let page = 1;
    return request().pipe(
      // Follow nextPageToken until there are no more pages or MAX_PAGES is reached.
      expand((response) =>
        response.nextPageToken && page++ < MAX_PAGES ? request(response.nextPageToken) : EMPTY,
      ),
      reduce((places, response) => [...places, ...(response.places ?? [])], [] as GooglePlace[]),
      map((places) => places.map(mapGooglePlace)),
      catchError((error) =>
        throwError(() =>
          error instanceof LeadSearchError
            ? error
            : new LeadSearchError('ERRORS.PROVIDER_FAILED', error),
        ),
      ),
    );
  }
}
