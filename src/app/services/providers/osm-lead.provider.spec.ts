import { Lead } from '../../models/lead.model';
import {
  buildOverpassQuery,
  hasRuntimeError,
  mapOverpassElement,
  withinRadius,
} from './osm-lead.provider';

const leiria = { displayName: 'Leiria', latitude: 39.74, longitude: -8.81 };

describe('OSM provider helpers', () => {
  it('builds a bbox query with one statement per unique selector', () => {
    const query = buildOverpassQuery(leiria, {
      locality: 'Leiria',
      categories: ['shops', 'services'],
      radiusKm: 2,
      source: 'osm',
    });
    expect(query).toMatch(
      /^\[out:json\]\[timeout:30\]\[bbox:39\.72\d*,-8\.83\d*,39\.75\d*,-8\.78\d*\];/,
    );
    expect(query).toContain('nwr["shop"]["name"];');
    expect(query).toContain('nwr["office"]["name"];');
    expect(query).toContain('nwr["craft"]["name"];');
    expect(query).not.toContain('around');
    expect(query).toContain('out center tags;');
  });

  it('searches a free-text sector by OSM tags and business names instead of categories', () => {
    const query = buildOverpassQuery(leiria, {
      locality: 'Leiria',
      sector: 'pedreiros',
      categories: ['shops'],
      radiusKm: 2,
      source: 'osm',
    });
    expect(query).toContain('nwr["craft"="stonemason"]["name"];');
    expect(query).toContain('nwr["craft"]["name"~"p(e|é|è|ê)dr(e|é|è|ê)(i|í|ì)",i];');
    expect(query).toContain('nwr["shop"]["name"~"p(e|é|è|ê)dr(e|é|è|ê)(i|í|ì)",i];');
    // Categories are ignored while a sector is set.
    expect(query).not.toContain('nwr["shop"]["name"];');
  });

  it('detects Overpass runtime errors returned with HTTP 200', () => {
    expect(
      hasRuntimeError({
        elements: [],
        remark: 'runtime error: Query timed out in "query" at line 9 after 68 seconds.',
      }),
    ).toBe(true);
    expect(hasRuntimeError({ elements: [] })).toBe(false);
  });

  it('keeps only leads inside the radius', () => {
    const at = (latitude: number, longitude: number) => ({ latitude, longitude }) as Lead;
    expect(withinRadius(at(39.745, -8.81), leiria, 2)).toBe(true);
    // Bbox corner (~2.8 km away) is outside a 2 km circle.
    expect(withinRadius(at(39.758, -8.833), leiria, 2)).toBe(false);
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
