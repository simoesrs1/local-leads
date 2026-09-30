import { isMobilePhone, splitPhones } from './phone.utils';

describe('phone utils', () => {
  it('detects Portuguese mobile numbers with or without country code', () => {
    expect(isMobilePhone('912 345 678')).toBe(true);
    expect(isMobilePhone('+351 961234567')).toBe(true);
    expect(isMobilePhone('00351 931234567')).toBe(true);
    expect(isMobilePhone('+351 244 123 456')).toBe(false);
  });

  it('splits multi-value tags and removes duplicates', () => {
    expect(splitPhones('+351 912 345 678; 244 000 000', '912345678', undefined)).toEqual([
      '+351 912 345 678',
      '244 000 000',
    ]);
  });

  it('ignores values that are too short to be phones', () => {
    expect(splitPhones('123')).toEqual([]);
  });
});
