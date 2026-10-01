import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { GeoLocation } from '../models/search.model';
import { LeadSearchError } from './lead-search.error';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface NominatimReverseResult {
  address?: Record<string, string>;
}

/** Address fields from most to least specific that make a good short place name. */
const PLACE_FIELDS = ['city', 'town', 'village', 'municipality', 'county', 'state'];

/** "Leiria, Portugal" from a Nominatim reverse-geocoding address. Exported for unit tests. */
export function shortPlaceName(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  const place = PLACE_FIELDS.map((field) => address[field]).find(Boolean);
  return [place, address['country']].filter(Boolean).join(', ') || null;
}

/** Resolves a locality name to coordinates using OpenStreetMap Nominatim (free, no key). */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'https://nominatim.openstreetmap.org/search';
  private readonly reverseEndpoint = 'https://nominatim.openstreetmap.org/reverse';

  geocode(locality: string): Observable<GeoLocation> {
    return this.http
      .get<NominatimResult[]>(this.endpoint, {
        params: { q: locality, format: 'jsonv2', limit: 1, addressdetails: 0 },
      })
      .pipe(
        catchError((error) =>
          throwError(() => new LeadSearchError('ERRORS.GEOCODING_FAILED', error)),
        ),
        map((results) => {
          const [first] = results;
          if (!first) throw new LeadSearchError('ERRORS.LOCALITY_NOT_FOUND');
          return {
            displayName: first.display_name,
            latitude: Number(first.lat),
            longitude: Number(first.lon),
          };
        }),
      );
  }

  /** Short place name for coordinates (e.g. "Leiria, Portugal"), or null on failure. */
  reverse(latitude: number, longitude: number, language: string): Observable<string | null> {
    return this.http
      .get<NominatimReverseResult>(this.reverseEndpoint, {
        // zoom=10 = city level; accept-language localises the country name.
        params: {
          lat: latitude,
          lon: longitude,
          format: 'jsonv2',
          zoom: 10,
          'accept-language': language,
        },
      })
      .pipe(
        map((result) => shortPlaceName(result.address)),
        catchError(() => of(null)),
      );
  }
}
