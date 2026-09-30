import { mapGooglePlace } from './google-places-lead.provider';

describe('mapGooglePlace', () => {
  it('maps a place to a lead without email', () => {
    const lead = mapGooglePlace({
      id: 'abc',
      displayName: { text: 'Oficina Silva' },
      formattedAddress: 'Rua B, Leiria',
      internationalPhoneNumber: '+351 912 345 678',
      primaryTypeDisplayName: { text: 'Car repair' },
      googleMapsUri: 'https://maps.google.com/?cid=1',
    });
    expect(lead).toMatchObject({
      id: 'google:abc',
      source: 'google',
      name: 'Oficina Silva',
      type: 'Car repair',
      phones: ['+351 912 345 678'],
      hasMobile: true,
      email: null,
      website: null,
      mapsUrl: 'https://maps.google.com/?cid=1',
    });
  });
});
