import { DEFAULT_FILTERS, LeadFilters } from '../models/filter.model';
import { Lead } from '../models/lead.model';
import { filterLeads } from './lead-filter.utils';

function lead(overrides: Partial<Lead>): Lead {
  return {
    id: overrides.name ?? 'id',
    source: 'osm',
    name: 'Business',
    type: 'Bakery',
    phones: [],
    hasMobile: false,
    email: null,
    website: null,
    address: null,
    latitude: null,
    longitude: null,
    mapsUrl: '',
    ...overrides,
  };
}

const leads: Lead[] = [
  lead({ name: 'Full', phones: ['912345678'], hasMobile: true, email: 'a@b.pt', website: 'a.pt' }),
  lead({ name: 'Landline only', phones: ['244000000'], type: 'Café' }),
  lead({ name: 'Email only', email: 'x@y.pt', address: 'Rua Direita, Leiria' }),
  lead({ name: 'Nothing' }),
];

const names = (filters: Partial<LeadFilters>) =>
  filterLeads(leads, { ...DEFAULT_FILTERS, ...filters }).map((item) => item.name);

describe('filterLeads', () => {
  it('returns everything with default filters', () => {
    expect(names({})).toHaveLength(4);
  });

  it('filters businesses without phone', () => {
    expect(names({ phone: 'without' })).toEqual(['Email only', 'Nothing']);
  });

  it('filters businesses without a mobile phone', () => {
    expect(names({ phone: 'withoutMobile' })).toEqual(['Landline only', 'Email only', 'Nothing']);
  });

  it('filters businesses without email', () => {
    expect(names({ email: 'without' })).toEqual(['Landline only', 'Nothing']);
  });

  it('filters businesses with email', () => {
    expect(names({ email: 'with' })).toEqual(['Full', 'Email only']);
  });

  it('filters businesses without website', () => {
    expect(names({ website: 'without' })).toEqual(['Landline only', 'Email only', 'Nothing']);
  });

  it('filters businesses without any contact data', () => {
    expect(names({ noContactData: true })).toEqual(['Nothing']);
  });

  it('combines filters with AND', () => {
    expect(names({ phone: 'without', email: 'without' })).toEqual(['Nothing']);
  });

  it('matches text against name, type and address ignoring accents and case', () => {
    expect(names({ text: 'cafe' })).toEqual(['Landline only']);
    expect(names({ text: 'LEIRIA' })).toEqual(['Email only']);
  });

  it('filters by contact history', () => {
    const contacted = (item: Lead) => item.name === 'Full';
    const run = (value: LeadFilters['contacted']) =>
      filterLeads(leads, { ...DEFAULT_FILTERS, contacted: value }, contacted).map(
        (item) => item.name,
      );
    expect(run('with')).toEqual(['Full']);
    expect(run('without')).toEqual(['Landline only', 'Email only', 'Nothing']);
  });

  it('filters by exact type', () => {
    expect(names({ type: 'Café' })).toEqual(['Landline only']);
  });
});
