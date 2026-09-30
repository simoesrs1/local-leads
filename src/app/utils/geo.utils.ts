const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

/** Bounding box [south, west, north, east] that contains a circle of `radiusKm` around a point. */
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number,
): [number, number, number, number] {
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  // Longitude degrees shrink towards the poles.
  const dLon = radiusKm / (KM_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180));
  return [latitude - dLat, longitude - dLon, latitude + dLat, longitude + dLon].map(
    (value) => Math.round(value * 1e6) / 1e6,
  ) as [number, number, number, number];
}

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
