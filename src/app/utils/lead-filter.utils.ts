import { LeadFilters, PresenceFilter } from '../models/filter.model';
import { Lead } from '../models/lead.model';
import { normalizeText } from './text.utils';

/**
 * Pure filter so it can be reused in computed signals and unit-tested in isolation.
 * `isContacted` comes from the send history (defaults to "never contacted").
 */
export function filterLeads(
  leads: Lead[],
  filters: LeadFilters,
  isContacted: (lead: Lead) => boolean = () => false,
): Lead[] {
  const text = normalizeText(filters.text);

  return leads.filter((lead) => {
    const hasPhone = lead.phones.length > 0;

    if (filters.noContactData && (hasPhone || lead.email || lead.website)) return false;
    if (filters.type && lead.type !== filters.type) return false;

    if (filters.phone === 'withoutMobile') {
      if (lead.hasMobile) return false;
    } else if (!matchesPresence(filters.phone, hasPhone)) {
      return false;
    }

    if (!matchesPresence(filters.email, !!lead.email)) return false;
    if (!matchesPresence(filters.website, !!lead.website)) return false;
    if (filters.contacted !== 'any' && !matchesPresence(filters.contacted, isContacted(lead))) {
      return false;
    }

    if (text) {
      const haystack = normalizeText(`${lead.name} ${lead.type} ${lead.address ?? ''}`);
      if (!haystack.includes(text)) return false;
    }

    return true;
  });
}

function matchesPresence(filter: PresenceFilter, present: boolean): boolean {
  if (filter === 'with') return present;
  if (filter === 'without') return !present;
  return true;
}
