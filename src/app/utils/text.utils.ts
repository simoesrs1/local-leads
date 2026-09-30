/** Lowercases and strips accents so "Leiria" matches "leíria". */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** "car_repair" -> "Car repair". */
export function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Builds a Google Maps search link for a business. */
export function buildMapsUrl(
  name: string,
  address: string | null,
  lat: number | null,
  lon: number | null,
): string {
  const query = address
    ? `${name}, ${address}`
    : lat !== null && lon !== null
      ? `${name} ${lat},${lon}`
      : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
