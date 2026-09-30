/** Splits OSM multi-value phone tags ("+351 244 000 000; 912 345 678") into a clean list. */
export function splitPhones(...values: (string | undefined)[]): string[] {
  const phones = values
    .filter((value): value is string => !!value)
    .flatMap((value) => value.split(/[;,/]/))
    .map((phone) => phone.trim())
    .filter((phone) => phone.replace(/\D/g, '').length >= 6);

  // Dedupe by digits so "+351 912345678" and "912 345 678" count once.
  const seen = new Set<string>();
  return phones.filter((phone) => {
    const key = localDigits(phone);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Portuguese mobile numbers have 9 digits starting with 9 (91x, 92x, 93x, 96x). */
export function isMobilePhone(phone: string): boolean {
  return /^9[1236]\d{7}$/.test(localDigits(phone));
}

/** Strips formatting and the Portuguese country code. */
function localDigits(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^(00351|351)(?=\d{9}$)/, '');
}
