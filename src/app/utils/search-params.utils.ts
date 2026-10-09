import { Params } from '@angular/router';
import {
  BUSINESS_CATEGORIES,
  DEFAULT_RADIUS_KM,
  DEFAULT_SOURCE,
  SearchCriteria,
} from '../models/search.model';

/**
 * Query params for /search that start a search right away:
 *   /search?locality=Lisboa,%20Portugal&lat=38.72&lon=-9.14&sector=pedreiros
 * `lat`/`lon` are optional (without them the locality is geocoded); `sector` is optional too.
 */
export interface SearchParams {
  locality: string;
  lat?: number;
  lon?: number;
}

export function toSearchParams(
  locality: string,
  center?: { latitude: number; longitude: number },
): SearchParams {
  // 4 decimals ≈ 11 m, plenty for a radius search and keeps the URL short.
  const round = (value: number) => Math.round(value * 1e4) / 1e4;
  return center
    ? { locality, lat: round(center.latitude), lon: round(center.longitude) }
    : { locality };
}

/** Builds search criteria from /search query params, or null when they do not describe a search. */
export function criteriaFromParams(params: Params): SearchCriteria | null {
  const locality = typeof params['locality'] === 'string' ? params['locality'].trim() : '';
  if (!locality) return null;

  const latitude = Number(params['lat']);
  const longitude = Number(params['lon']);
  const validCenter =
    params['lat'] !== undefined &&
    params['lon'] !== undefined &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const sector = typeof params['sector'] === 'string' ? params['sector'].trim() : '';

  return {
    locality,
    sector: sector || undefined,
    categories: [...BUSINESS_CATEGORIES],
    radiusKm: DEFAULT_RADIUS_KM,
    source: DEFAULT_SOURCE,
    center: validCenter ? { latitude, longitude } : undefined,
  };
}
