import { normalizeText } from './text.utils';

/**
 * Known business sectors for the free-text "sector" search.
 * `keywords` are accent-free stems in PT and EN (matched as prefixes of the typed words);
 * `selectors` are the OpenStreetMap tags that identify the sector (each also requires a name).
 */
export interface Sector {
  id: string;
  keywords: string[];
  selectors: string[];
}

export const SECTORS: Sector[] = [
  {
    id: 'construction',
    keywords: [
      'constru',
      'obra',
      'empreiteir',
      'remodela',
      'reabilita',
      'builder',
      'contractor',
      'renovat',
    ],
    selectors: [
      '["craft"="builder"]',
      '["office"="construction_company"]',
      '["craft"="construction"]',
    ],
  },
  {
    id: 'masonry',
    keywords: ['pedreir', 'alvenari', 'mason', 'calceteir'],
    selectors: ['["craft"="stonemason"]', '["craft"="builder"]'],
  },
  {
    id: 'electrician',
    keywords: ['eletric', 'electric', 'eletricist', 'electrician'],
    selectors: ['["craft"="electrician"]', '["shop"="electrical"]'],
  },
  {
    id: 'plumber',
    keywords: ['canaliz', 'picheleir', 'plumb'],
    selectors: ['["craft"="plumber"]'],
  },
  {
    id: 'carpenter',
    keywords: ['carpint', 'marceneir', 'carpenter', 'joiner', 'cabinet'],
    selectors: ['["craft"~"^(carpenter|joiner|cabinet_maker)$"]'],
  },
  {
    id: 'painter',
    keywords: ['pintor', 'pintura', 'painter', 'painting'],
    selectors: ['["craft"="painter"]'],
  },
  {
    id: 'roofer',
    keywords: ['telhad', 'cobertur', 'roof'],
    selectors: ['["craft"="roofer"]'],
  },
  {
    id: 'metalwork',
    keywords: ['serralh', 'metalomec', 'soldad', 'metalwork', 'welder', 'locksmith', 'chaveir'],
    selectors: ['["craft"~"^(metal_construction|locksmith|welder|blacksmith)$"]'],
  },
  {
    id: 'hvac',
    keywords: ['climatiz', 'aquecimento', 'hvac', 'heating', 'aircon'],
    selectors: ['["craft"="hvac"]'],
  },
  {
    id: 'glazier',
    keywords: ['vidrac', 'vidrar', 'glazier', 'glass'],
    selectors: ['["craft"="glaziery"]'],
  },
  {
    id: 'gardening',
    keywords: ['jardin', 'paisagis', 'garden', 'landscap'],
    selectors: ['["craft"="gardener"]', '["shop"="garden_centre"]'],
  },
  {
    id: 'cleaning',
    keywords: ['limpez', 'lavandari', 'cleaning', 'laundry'],
    selectors: ['["craft"="cleaning"]', '["shop"~"^(laundry|dry_cleaning)$"]'],
  },
  {
    id: 'building_supplies',
    keywords: ['materiai', 'ferrage', 'bricolag', 'drogari', 'hardware', 'diy'],
    selectors: ['["shop"~"^(doityourself|hardware|trade|paint)$"]'],
  },
  {
    id: 'accounting',
    keywords: ['contabil', 'accountan', 'bookkeep'],
    selectors: ['["office"~"^(accountant|tax_advisor)$"]'],
  },
  {
    id: 'legal',
    keywords: ['advog', 'solicitad', 'lawyer', 'notari', 'notary'],
    selectors: ['["office"~"^(lawyer|notary)$"]'],
  },
  {
    id: 'real_estate',
    keywords: ['imobili', 'realestat', 'estate'],
    selectors: ['["office"="estate_agent"]', '["shop"="estate_agent"]'],
  },
  {
    id: 'architecture',
    keywords: ['arquitet', 'arquitect', 'architect', 'engenhar', 'engineer'],
    selectors: ['["office"~"^(architect|engineer)$"]'],
  },
  {
    id: 'insurance',
    keywords: ['segur', 'insuranc'],
    selectors: ['["office"="insurance"]'],
  },
  {
    id: 'auto_repair',
    keywords: ['oficina', 'mecanic', 'automov', 'garage', 'mechanic', 'carrepair'],
    selectors: ['["shop"~"^(car_repair|tyres|car_parts)$"]'],
  },
  {
    id: 'hairdresser',
    keywords: ['cabeleir', 'barbeir', 'hairdress', 'barber', 'estetica', 'beauty'],
    selectors: ['["shop"~"^(hairdresser|beauty)$"]'],
  },
  {
    id: 'restaurant',
    keywords: ['restaura', 'tasca', 'churrasq', 'pizzar'],
    selectors: ['["amenity"~"^(restaurant|fast_food)$"]'],
  },
  {
    id: 'bakery',
    keywords: ['padari', 'pastelari', 'bakery', 'pastry', 'confeitari'],
    selectors: ['["shop"~"^(bakery|pastry|confectionery)$"]'],
  },
  {
    id: 'photography',
    keywords: ['fotograf', 'photograph'],
    selectors: ['["craft"="photographer"]', '["shop"="photo"]'],
  },
  {
    id: 'fitness',
    keywords: ['ginasi', 'fitness', 'gym', 'pilates', 'crossfit'],
    selectors: ['["leisure"="fitness_centre"]'],
  },
];

const STOP_WORDS = new Set([
  'and',
  'the',
  'com',
  'para',
  'dos',
  'das',
  'por',
  'civil',
  'servicos',
  'services',
]);

/** Meaningful, accent-free words of the typed sector ("Construção civil" -> ["construcao"]). */
export function sectorWords(query: string): string[] {
  return normalizeText(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/** Sectors whose keywords match the typed words (prefix match both ways, e.g. "pedreiros" ~ "pedreir"). */
export function matchSectors(query: string): Sector[] {
  const words = sectorWords(query);
  return SECTORS.filter((sector) =>
    sector.keywords.some((keyword) =>
      words.some(
        (word) => word.startsWith(keyword) || (word.length >= 4 && keyword.startsWith(word)),
      ),
    ),
  );
}

/** OpenStreetMap selectors for all matched sectors, without duplicates. */
export function sectorSelectors(query: string): string[] {
  return [...new Set(matchSectors(query).flatMap((sector) => sector.selectors))];
}

// Alternations instead of [aá] classes: accented letters are 2 bytes in UTF-8 and a byte-oriented
// regex engine would treat a class as single bytes.
const ACCENT_CLASSES: Record<string, string> = {
  a: '(a|á|à|â|ã)',
  e: '(e|é|è|ê)',
  i: '(i|í|ì)',
  o: '(o|ó|ò|ô|õ)',
  u: '(u|ú|ù|ü)',
  c: '(c|ç)',
};

/**
 * Case/accent-insensitive regex for business names, built from word stems
 * ("pedreiros" -> "p(e|é|è|ê)dr(e|é|è|ê)(i|í|ì)", matches "Pedreiro Silva", "Pedreira"...).
 * Only [a-z0-9] reach the regex, so user input cannot inject Overpass syntax.
 */
export function nameRegex(query: string): string | null {
  const stems = sectorWords(query).map((word) =>
    word.slice(0, Math.max(4, Math.min(word.length - 1, 6))),
  );
  if (!stems.length) return null;
  return [...new Set(stems)]
    .map((stem) => [...stem].map((char) => ACCENT_CLASSES[char] ?? char).join(''))
    .join('|');
}
