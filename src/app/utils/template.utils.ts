import { LeadField, TemplateVariable } from '../models/email.model';
import { Lead } from '../models/lead.model';

/** Matches {{key}} and {{ key }}. */
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const KEY = /^[a-z][a-z0-9_]*$/;

/** "Nome Cliente" -> "nome_cliente" (accents removed, lowercase, underscores). */
export function slugifyKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'v_$1');
}

export function isValidKey(key: string): boolean {
  return KEY.test(key);
}

/** Distinct keys used in a text, in order of appearance. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))];
}

/** Context that is not part of the lead itself (e.g. the searched locality). */
export interface TemplateContext {
  locality: string;
}

export function leadFieldValue(lead: Lead, field: LeadField, context: TemplateContext): string {
  switch (field) {
    case 'name':
      return lead.name;
    case 'type':
      return lead.type;
    case 'email':
      return lead.email ?? '';
    case 'phone':
      return lead.phones[0] ?? '';
    case 'website':
      return lead.website ?? '';
    case 'address':
      return lead.address ?? '';
    case 'locality':
      // "Lisboa, Portugal" -> "Lisboa"
      return context.locality.split(',')[0].trim();
  }
}

/** Value of every variable for one lead. */
export function buildValues(
  variables: TemplateVariable[],
  lead: Lead,
  context: TemplateContext,
): Record<string, string> {
  return Object.fromEntries(
    variables.map((variable) => [
      variable.key,
      variable.source === 'custom'
        ? variable.value
        : leadFieldValue(lead, variable.source, context),
    ]),
  );
}

export interface RenderResult {
  text: string;
  /** Placeholders with no matching variable; left untouched in the text. */
  unknown: string[];
  /** Variables that exist but resolved to an empty value for this lead. */
  empty: string[];
}

export function renderTemplate(text: string, values: Record<string, string>): RenderResult {
  const unknown = new Set<string>();
  const empty = new Set<string>();
  const rendered = text.replace(PLACEHOLDER, (match, key: string) => {
    if (!(key in values)) {
      unknown.add(key);
      return match;
    }
    if (!values[key]) empty.add(key);
    return values[key];
  });
  return { text: rendered, unknown: [...unknown], empty: [...empty] };
}

export interface RenderedEmail {
  lead: Lead;
  subject: string;
  body: string;
  unknown: string[];
  empty: string[];
}

/** Renders subject and body of a template for one lead. */
export function renderEmail(
  template: { subject: string; body: string },
  variables: TemplateVariable[],
  lead: Lead,
  context: TemplateContext,
): RenderedEmail {
  const values = buildValues(variables, lead, context);
  const subject = renderTemplate(template.subject, values);
  const body = renderTemplate(template.body, values);
  return {
    lead,
    // Subjects are single-line: collapse any line breaks a value might add.
    subject: subject.text.replace(/\s*\n\s*/g, ' ').trim(),
    body: body.text,
    unknown: [...new Set([...subject.unknown, ...body.unknown])],
    empty: [...new Set([...subject.empty, ...body.empty])],
  };
}
