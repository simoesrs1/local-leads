import { Injectable } from '@angular/core';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Wraps the browser Geolocation API. Calling `locate()` triggers the browser's permission prompt. */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  /** Resolves with the user's position, or null when denied, unavailable or timed out. Never rejects. */
  locate(): Promise<Coordinates | null> {
    if (!('geolocation' in navigator)) return Promise.resolve(null);

    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => resolve(null),
        // City-level accuracy is enough for the globe; reuse a recent fix to avoid waiting.
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60 * 60 * 1000 },
      ),
    );
  }
}
