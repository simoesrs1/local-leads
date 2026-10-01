import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { GeocodingService, shortPlaceName } from './geocoding.service';

describe('shortPlaceName', () => {
  it('prefers city, then town/village, and appends the country', () => {
    expect(shortPlaceName({ city: 'Leiria', county: 'Leiria', country: 'Portugal' })).toBe(
      'Leiria, Portugal',
    );
    expect(shortPlaceName({ village: 'Maceira', country: 'Portugal' })).toBe('Maceira, Portugal');
  });

  it('returns null when there is no usable field', () => {
    expect(shortPlaceName(undefined)).toBeNull();
    expect(shortPlaceName({ postcode: '2400' })).toBeNull();
  });
});

describe('GeocodingService.reverse', () => {
  let service: GeocodingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeocodingService);
    http = TestBed.inject(HttpTestingController);
  });

  it('requests a city-level reverse lookup in the UI language', async () => {
    const result = firstValueFrom(service.reverse(39.74, -8.81, 'pt'));
    const request = http.expectOne((req) => req.url.endsWith('/reverse'));
    expect(request.request.params.get('zoom')).toBe('10');
    expect(request.request.params.get('accept-language')).toBe('pt');
    request.flush({ address: { city: 'Leiria', country: 'Portugal' } });
    expect(await result).toBe('Leiria, Portugal');
  });

  it('resolves to null when the lookup fails', async () => {
    const result = firstValueFrom(service.reverse(0, 0, 'en'));
    http.expectOne(() => true).flush('error', { status: 500, statusText: 'Server Error' });
    expect(await result).toBeNull();
  });
});
