import { HistoryEntry } from '../models/email.model';
import { Lead } from '../models/lead.model';
import { buildContactIndex, lastContact } from './history.utils';

function entry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: Math.random().toString(),
    leadId: 'osm:node/1',
    leadName: 'Padaria',
    leadEmail: 'geral@padaria.pt',
    to: 'geral@padaria.pt',
    subject: 'Olá',
    templateId: null,
    templateName: null,
    testMode: false,
    status: 'sent',
    sentAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

const lead = (overrides: Partial<Lead>): Lead => ({
  id: 'osm:node/1',
  source: 'osm',
  name: 'Padaria',
  type: 'Bakery',
  phones: [],
  hasMobile: false,
  email: 'geral@padaria.pt',
  website: null,
  address: null,
  latitude: null,
  longitude: null,
  mapsUrl: '',
  ...overrides,
});

describe('contact history', () => {
  it('ignores test sends and failures', () => {
    const index = buildContactIndex([
      entry({ testMode: true }),
      entry({ status: 'failed', leadId: 'osm:node/2', leadEmail: 'x@y.pt' }),
    ]);
    expect(lastContact(index, lead({}))).toBeUndefined();
    expect(lastContact(index, lead({ id: 'osm:node/2', email: 'x@y.pt' }))).toBeUndefined();
  });

  it('matches by lead id or by email (case-insensitive) and keeps the latest', () => {
    const index = buildContactIndex([
      entry({ sentAt: '2026-10-01T10:00:00.000Z' }),
      entry({
        leadId: 'google:abc',
        leadEmail: 'GERAL@padaria.pt',
        sentAt: '2026-10-05T10:00:00.000Z',
      }),
    ]);
    expect(lastContact(index, lead({}))?.sentAt).toBe('2026-10-05T10:00:00.000Z');
    expect(lastContact(index, lead({ id: 'other', email: 'geral@PADARIA.pt' }))).toBeDefined();
    expect(lastContact(index, lead({ id: 'other', email: null }))).toBeUndefined();
  });
});
