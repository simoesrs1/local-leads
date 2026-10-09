import { HistoryEntry } from '../models/email.model';
import { Lead } from '../models/lead.model';

/** Latest real (non-test) successful email per lead id and per email address. */
export interface ContactIndex {
  byLeadId: Map<string, HistoryEntry>;
  byEmail: Map<string, HistoryEntry>;
}

/**
 * Only live "sent" entries count as contacted: test sends never reached the business.
 * Matching by email too catches the same business found again under another id/source.
 */
export function buildContactIndex(entries: HistoryEntry[]): ContactIndex {
  const index: ContactIndex = { byLeadId: new Map(), byEmail: new Map() };
  for (const entry of entries) {
    if (entry.testMode || entry.status !== 'sent') continue;
    keepLatest(index.byLeadId, entry.leadId, entry);
    if (entry.leadEmail) keepLatest(index.byEmail, entry.leadEmail.toLowerCase(), entry);
  }
  return index;
}

export function lastContact(index: ContactIndex, lead: Lead): HistoryEntry | undefined {
  const byId = index.byLeadId.get(lead.id);
  const byEmail = lead.email ? index.byEmail.get(lead.email.toLowerCase()) : undefined;
  if (byId && byEmail) return byId.sentAt >= byEmail.sentAt ? byId : byEmail;
  return byId ?? byEmail;
}

function keepLatest(map: Map<string, HistoryEntry>, key: string, entry: HistoryEntry): void {
  const current = map.get(key);
  if (!current || entry.sentAt > current.sentAt) map.set(key, entry);
}
