/** Tri-state presence filter for a contact field. */
export type PresenceFilter = 'any' | 'with' | 'without';

/** Phone has an extra option because mobile numbers matter for outreach. */
export type PhoneFilter = PresenceFilter | 'withoutMobile';

/** Client-side filters applied to the current search results. */
export interface LeadFilters {
  /** Matches name, type or address (case/accent insensitive). */
  text: string;
  /** Exact business type, or '' for all. */
  type: string;
  phone: PhoneFilter;
  email: PresenceFilter;
  website: PresenceFilter;
  /** Only businesses with no phone, no email and no website. */
  noContactData: boolean;
  /** Already emailed (live mode) according to the send history. */
  contacted: PresenceFilter;
}

export const DEFAULT_FILTERS: LeadFilters = {
  text: '',
  type: '',
  phone: 'any',
  email: 'any',
  website: 'any',
  noContactData: false,
  contacted: 'any',
};
