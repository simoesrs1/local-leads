import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../public/i18n/en.json';
import pt from '../../public/i18n/pt.json';
import { LEAD_FIELDS } from './models/email.model';
import { BUSINESS_CATEGORIES } from './models/search.model';

/** Collects every static `'SOME.KEY'` literal used in templates (dynamic prefixes like 'FILTERS.PHONE_' are skipped). */
function templateKeys(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return templateKeys(path);
    if (!path.endsWith('.html')) return [];
    return [...readFileSync(path, 'utf8').matchAll(/'([A-Z_]+\.[A-Z_]*[A-Z])'/g)].map(
      (match) => match[1],
    );
  });
}

describe('translations', () => {
  it('en.json and pt.json have the same keys', () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  });

  it('every static key used in templates exists', () => {
    const missing = templateKeys('src/app').filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });

  it('every dynamically built key exists', () => {
    const dynamic = [
      ...BUSINESS_CATEGORIES.map((category) => `CATEGORIES.${category.toUpperCase()}`),
      ...['osm', 'google'].map((source) => `SOURCES.${source.toUpperCase()}`),
      ...['any', 'with', 'without', 'withoutMobile'].map(
        (option) => `FILTERS.PHONE_${option.toUpperCase()}`,
      ),
      ...['EMAIL', 'WEBSITE'].flatMap((field) =>
        ['ANY', 'WITH', 'WITHOUT'].map((option) => `FILTERS.${field}_${option}`),
      ),
    ];
    // Home page sections built from `<key> + '_TITLE' | '_TEXT'`.
    const homeSections = [
      'HOME.STEP_1',
      'HOME.STEP_2',
      'HOME.STEP_3',
      'HOME.FEATURE_SOURCES',
      'HOME.FEATURE_FILTERS',
      'HOME.FEATURE_MOBILE',
      'HOME.FEATURE_EXPORT',
      'HOME.FEATURE_I18N',
      'HOME.FEATURE_EMAIL',
    ].flatMap((key) => [`${key}_TITLE`, `${key}_TEXT`]);
    const emailKeys = [
      ...LEAD_FIELDS.map((field) => `FIELDS.${field.toUpperCase()}`),
      'SETTINGS.PRESET_GMAIL',
      'SETTINGS.PRESET_OFFICE365',
    ];
    expect([...dynamic, ...homeSections, ...emailKeys].filter((key) => !(key in en))).toEqual([]);
  });

  it('every error key returned by the email server exists', () => {
    const serverKeys = readdirSync('server')
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .flatMap((file) => [
        ...readFileSync(join('server', file), 'utf8').matchAll(/'(EMAIL_ERRORS\.[A-Z_]+)'/g),
      ])
      .map((match) => match[1]);
    expect(serverKeys.length).toBeGreaterThan(0);
    expect(serverKeys.filter((key) => !(key in en))).toEqual([]);
  });
});
