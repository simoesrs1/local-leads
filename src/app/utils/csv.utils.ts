import { Lead } from '../models/lead.model';

const HEADERS = ['Name', 'Type', 'Phones', 'Email', 'Website', 'Address', 'Google Maps', 'Source'];

/** Serialises leads to CSV (semicolon separated so Excel PT opens it correctly). */
export function leadsToCsv(leads: Lead[]): string {
  const rows = leads.map((lead) => [
    lead.name,
    lead.type,
    lead.phones.join(' | '),
    lead.email ?? '',
    lead.website ?? '',
    lead.address ?? '',
    lead.mapsUrl,
    lead.source,
  ]);
  return [HEADERS, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n');
}

/** Triggers a browser download. BOM keeps accents intact in Excel. */
export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
