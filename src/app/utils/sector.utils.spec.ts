import en from '../../../public/i18n/en.json';
import pt from '../../../public/i18n/pt.json';
import { SECTORS, matchSectors, nameRegex, sectorSelectors, sectorWords } from './sector.utils';

const ids = (query: string) => matchSectors(query).map((sector) => sector.id);

describe('sector search', () => {
  it('extracts meaningful accent-free words', () => {
    expect(sectorWords('Construção civil e obras')).toEqual(['construcao', 'obras']);
  });

  it('matches Portuguese and English terms, singular or plural', () => {
    expect(ids('pedreiros')).toContain('masonry');
    expect(ids('Pedreiro')).toContain('masonry');
    expect(ids('construção')).toContain('construction');
    expect(ids('canalizadores')).toEqual(['plumber']);
    expect(ids('electricians')).toEqual(['electrician']);
    expect(ids('contabilidade')).toEqual(['accounting']);
  });

  it('maps a sector to OpenStreetMap tags', () => {
    expect(sectorSelectors('pedreiros')).toEqual(['["craft"="stonemason"]', '["craft"="builder"]']);
  });

  it('returns nothing for unknown sectors (the name search still applies)', () => {
    expect(ids('xyzabc')).toEqual([]);
    expect(nameRegex('xyzabc')).toBe('xyz(a|á|à|â|ã)b');
  });

  it('builds an accent-insensitive, injection-safe name regex', () => {
    expect(nameRegex('construção')).toBe('(c|ç)(o|ó|ò|ô|õ)nstr');
    expect(nameRegex('pedreiros')).toBe('p(e|é|è|ê)dr(e|é|è|ê)(i|í|ì)');
    // Only letters/digits survive, so quotes/brackets cannot break the Overpass query.
    expect(nameRegex('"]; out; //')).toBe('(o|ó|ò|ô|õ)(u|ú|ù|ü)t');
    expect(nameRegex('  ')).toBeNull();
  });

  it('every sector label (PT and EN) matches its own sector', () => {
    for (const sector of SECTORS) {
      const key = `SECTORS.${sector.id.toUpperCase()}` as keyof typeof en;
      expect(ids(en[key])).toContain(sector.id);
      expect(ids(pt[key as keyof typeof pt])).toContain(sector.id);
    }
  });
});
