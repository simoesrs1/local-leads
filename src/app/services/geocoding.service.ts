import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { GeoLocation } from '../models/search.model';
import { LeadSearchError } from './lead-search.error';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

/** Resolves a locality name to coordinates using OpenStreetMap Nominatim (free, no key). */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'https://nominatim.openstreetmap.org/search';

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
}
