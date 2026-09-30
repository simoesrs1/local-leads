import { buildOverpassQuery, mapOverpassElement } from './osm-lead.provider';

describe('OSM provider helpers', () => {
  it('builds an around query with one statement per unique selector', () => {
    const query = buildOverpassQuery(
      { displayName: 'Leiria', latitude: 39.74, longitude: -8.81 },
      { locality: 'Leiria', categories: ['shops', 'services'], radiusKm: 2, source: 'osm' },
    );
    expect(query).toContain('nwr["shop"]["name"](around:2000,39.74,-8.81);');
    expect(query).toContain('nwr["office"]["name"](around:2000,39.74,-8.81);');
    expect(query).toContain('nwr["craft"]["name"](around:2000,39.74,-8.81);');
    expect(query).toContain('out center tags;');
  });

  it('maps tags to a lead', () => {
    const lead = mapOverpassElement({
      type: 'way',
      id: 42,
      center: { lat: 39.7, lon: -8.8 },
      tags: {
        name: 'Padaria Leiria',
        shop: 'bakery',
        'contact:phone': '+351 244 000 000;+351 912 345 678',
        email: 'geral@padaria.pt',
        'addr:street': 'Rua Direita',
        'addr:housenumber': '10',
        'addr:postcode': '2400-000',
        'addr:city': 'Leiria',
      },
    });
    expect(lead).toMatchObject({
      id: 'osm:way/42',
      name: 'Padaria Leiria',
      type: 'Bakery',
      phones: ['+351 244 000 000', '+351 912 345 678'],
      hasMobile: true,
      email: 'geral@padaria.pt',
      website: null,
      address: 'Rua Direita 10, 2400-000 Leiria',
      latitude: 39.7,
      longitude: -8.8,
    });
  });

  it('uses the tag key as type when the value is generic', () => {
    expect(
      mapOverpassElement({ type: 'node', id: 1, tags: { name: 'X', office: 'yes' } })?.type,
    ).toBe('Office');
  });

  it('skips elements without a name', () => {
    expect(mapOverpassElement({ type: 'node', id: 1, tags: { shop: 'bakery' } })).toBeNull();
  });
});
