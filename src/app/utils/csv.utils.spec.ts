import { Lead } from '../models/lead.model';
import { leadsToCsv } from './csv.utils';

describe('leadsToCsv', () => {
  it('writes a header and escapes cells containing separators or quotes', () => {
    const lead: Lead = {
      id: '1',
      source: 'osm',
      name: 'Café "Central"; Lda',
      type: 'Cafe',
      phones: ['912345678', '244000000'],
      hasMobile: true,
      email: null,
      website: null,
      address: 'Rua A, Leiria',
      latitude: null,
      longitude: null,
      mapsUrl: 'https://maps',
    };
    const [header, row] = leadsToCsv([lead]).split('\r\n');
    expect(header).toBe('Name;Type;Phones;Email;Website;Address;Google Maps;Source');
    expect(row).toBe(
      '"Café ""Central""; Lda";Cafe;912345678 | 244000000;;;Rua A, Leiria;https://maps;osm',
    );
  });
});
