import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { LEAD_PROVIDERS } from './services/providers/lead-provider';
import { GooglePlacesLeadProvider } from './services/providers/google-places-lead.provider';
import { OsmLeadProvider } from './services/providers/osm-lead.provider';
import { TranslationService } from './services/translation.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Scroll to top on navigation and support #anchor links (e.g. /#how-it-works).
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    // Load the translation file before the first render.
    provideAppInitializer(() => inject(TranslationService).init()),
    // Data sources; order defines the order in the source dropdown.
    { provide: LEAD_PROVIDERS, useExisting: OsmLeadProvider, multi: true },
    { provide: LEAD_PROVIDERS, useExisting: GooglePlacesLeadProvider, multi: true },
  ],
};
