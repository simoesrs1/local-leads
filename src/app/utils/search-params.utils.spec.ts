import { criteriaFromParams, toSearchParams } from './search-params.utils';

describe('search params', () => {
  it('round-trips a geolocated search', () => {
    const params = toSearchParams('Lisboa, Portugal', {
      latitude: 38.722345,
      longitude: -9.139321,
    });
    expect(params).toEqual({ locality: 'Lisboa, Portugal', lat: 38.7223, lon: -9.1393 });

    const criteria = criteriaFromParams({
      locality: params.locality,
      lat: '38.7223',
      lon: '-9.1393',
    });
    expect(criteria).toMatchObject({
      locality: 'Lisboa, Portugal',
      radiusKm: 2,
      source: 'osm',
      center: { latitude: 38.7223, longitude: -9.1393 },
    });
    expect(criteria?.categories.length).toBeGreaterThan(0);
  });

  it('falls back to geocoding when coordinates are missing or invalid', () => {
    expect(criteriaFromParams({ locality: 'Leiria' })?.center).toBeUndefined();
    expect(
      criteriaFromParams({ locality: 'Leiria', lat: 'abc', lon: '1' })?.center,
    ).toBeUndefined();
    expect(
      criteriaFromParams({ locality: 'Leiria', lat: '120', lon: '1' })?.center,
    ).toBeUndefined();
  });

  it('reads an optional sector', () => {
    expect(criteriaFromParams({ locality: 'Leiria', sector: ' pedreiros ' })?.sector).toBe(
      'pedreiros',
    );
    expect(criteriaFromParams({ locality: 'Leiria' })?.sector).toBeUndefined();
  });

  it('ignores params without a locality', () => {
    expect(criteriaFromParams({})).toBeNull();
    expect(criteriaFromParams({ locality: '  ', lat: '1', lon: '1' })).toBeNull();
  });
});
