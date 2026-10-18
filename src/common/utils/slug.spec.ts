import { nextAvailableSlug, slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('  Acme Events & Co. ')).toBe('acme-events-co');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Révolution')).toBe('cafe-revolution');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('org');
  });

  it('truncates without leaving a trailing hyphen', () => {
    expect(slugify('abc def', 4)).toBe('abc');
  });
});

describe('nextAvailableSlug', () => {
  it('returns the base when it is free', () => {
    expect(nextAvailableSlug('acme', new Set())).toBe('acme');
  });

  it('returns the lowest free numeric suffix', () => {
    expect(nextAvailableSlug('acme', new Set(['acme', 'acme-2']))).toBe(
      'acme-3',
    );
    expect(nextAvailableSlug('acme', new Set(['acme', 'acme-3']))).toBe(
      'acme-2',
    );
  });

  it('keeps suffixed slugs within the max length', () => {
    const base = 'a'.repeat(10);
    const slug = nextAvailableSlug(base, new Set([base]), 10);
    expect(slug).toBe('aaaaaaaa-2');
    expect(slug).toHaveLength(10);
  });
});
