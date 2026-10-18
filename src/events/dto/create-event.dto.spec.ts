import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Industry } from '@prisma/client';
import {
  CreateEventDto,
  STARTS_AT_PAST_TOLERANCE_MS,
} from './create-event.dto';

const inMs = (offset: number) => new Date(Date.now() + offset).toISOString();

function build(overrides: Record<string, unknown> = {}) {
  return plainToInstance(CreateEventDto, {
    name: 'Radiohead Live',
    description: 'A live performance.',
    imageUrl: 'https://example.com/event.jpg',
    category: 'CONCERTS',
    venue: 'Amphitheater',
    timezone: 'Europe/London',
    startsAt: inMs(24 * 60 * 60 * 1000),
    ...overrides,
  });
}

describe('CreateEventDto', () => {
  it('accepts a well-formed payload with only required fields', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid maxResaleMultiplierBps and royaltyBps', async () => {
    const errors = await validate(
      build({ maxResaleMultiplierBps: 12_000, royaltyBps: 500 }),
    );
    expect(errors).toHaveLength(0);
  });

  it('accepts a null imageUrl', async () => {
    const errors = await validate(build({ imageUrl: null }));
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid imageUrl', async () => {
    const errors = await validate(build({ imageUrl: 'not-a-url' }));
    expect(errors.some((e) => e.property === 'imageUrl')).toBe(true);
  });

  it('accepts a valid IANA timezone and rejects an invalid one', async () => {
    await expect(
      validate(build({ timezone: 'Africa/Lagos' })),
    ).resolves.toHaveLength(0);

    const errors = await validate(build({ timezone: 'Mars/Olympus_Mons' }));
    expect(errors.some((e) => e.property === 'timezone')).toBe(true);
  });

  it('rejects a maxResaleMultiplierBps below 100% (would be a discount, not a cap)', async () => {
    const errors = await validate(build({ maxResaleMultiplierBps: 9_000 }));
    expect(errors.some((e) => e.property === 'maxResaleMultiplierBps')).toBe(
      true,
    );
  });

  it('rejects a royaltyBps above 20%', async () => {
    const errors = await validate(build({ royaltyBps: 2_500 }));
    expect(errors.some((e) => e.property === 'royaltyBps')).toBe(true);
  });

  it('rejects a non-date startsAt', async () => {
    const errors = await validate(build({ startsAt: 'not-a-date' }));
    expect(errors.some((e) => e.property === 'startsAt')).toBe(true);
  });

  it('rejects a startsAt that has already elapsed', async () => {
    const errors = await validate(
      build({ startsAt: inMs(-24 * 60 * 60 * 1000) }),
    );
    const startsAtError = errors.find((e) => e.property === 'startsAt');

    expect(startsAtError).toBeDefined();
    expect(Object.values(startsAtError?.constraints ?? {})).toContain(
      'startsAt must not be in the past',
    );
  });

  it('tolerates a startsAt slightly in the past to absorb clock skew', async () => {
    const errors = await validate(
      build({ startsAt: inMs(-STARTS_AT_PAST_TOLERANCE_MS / 2) }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a startsAt just beyond the clock tolerance', async () => {
    const errors = await validate(
      build({ startsAt: inMs(-STARTS_AT_PAST_TOLERANCE_MS * 2) }),
    );
    expect(errors.some((e) => e.property === 'startsAt')).toBe(true);
  });

  it('rejects an unrecognized category and lists the allowed values', async () => {
    const errors = await validate(build({ category: 'SPACE_TRAVEL' }));
    const categoryError = errors.find((e) => e.property === 'category');

    expect(categoryError).toBeDefined();
    const message = Object.values(categoryError?.constraints ?? {})[0];
    expect(message).toContain('category must be one of');
    for (const value of Object.values(Industry)) {
      expect(message).toContain(value);
    }
  });

  it('accepts a payload with ticket types', async () => {
    const errors = await validate(
      build({
        ticketTypes: [{ name: 'General', price: '1000', quantityTotal: 100 }],
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a ticket type missing a required field', async () => {
    const errors = await validate(
      build({ ticketTypes: [{ price: '1000', quantityTotal: 100 }] }),
    );
    expect(errors.some((e) => e.property === 'ticketTypes')).toBe(true);
  });

  describe('royaltyBps and maxResaleMultiplierBps (#97)', () => {
    it('accepts royaltyBps at the minimum boundary (0)', async () => {
      const errors = await validate(build({ royaltyBps: 0 }));
      expect(errors).toHaveLength(0);
    });

    it('accepts royaltyBps at the maximum boundary (2000 bps = 20%)', async () => {
      const errors = await validate(build({ royaltyBps: 2_000 }));
      expect(errors).toHaveLength(0);
    });

    it('rejects a negative royaltyBps', async () => {
      const errors = await validate(build({ royaltyBps: -1 }));
      expect(errors.some((e) => e.property === 'royaltyBps')).toBe(true);
    });

    it('accepts maxResaleMultiplierBps at the minimum boundary (10000 bps = 100%)', async () => {
      const errors = await validate(build({ maxResaleMultiplierBps: 10_000 }));
      expect(errors).toHaveLength(0);
    });

    it('accepts maxResaleMultiplierBps at the maximum boundary (50000 bps = 500%)', async () => {
      const errors = await validate(build({ maxResaleMultiplierBps: 50_000 }));
      expect(errors).toHaveLength(0);
    });

    it('rejects maxResaleMultiplierBps above 50000 bps', async () => {
      const errors = await validate(build({ maxResaleMultiplierBps: 50_001 }));
      expect(errors.some((e) => e.property === 'maxResaleMultiplierBps')).toBe(
        true,
      );
    });

    it('rejects a non-integer royaltyBps', async () => {
      const errors = await validate(build({ royaltyBps: 1.5 }));
      expect(errors.some((e) => e.property === 'royaltyBps')).toBe(true);
    });

    it('rejects a non-integer maxResaleMultiplierBps', async () => {
      const errors = await validate(
        build({ maxResaleMultiplierBps: 10_000.5 }),
      );
      expect(errors.some((e) => e.property === 'maxResaleMultiplierBps')).toBe(
        true,
      );
    });
  });

  describe('max length (#400)', () => {
    it('rejects a name over 256 characters', async () => {
      const errors = await validate(build({ name: 'a'.repeat(257) }));
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('accepts a name at exactly 256 characters', async () => {
      const errors = await validate(build({ name: 'a'.repeat(256) }));
      expect(errors).toHaveLength(0);
    });

    it('rejects a venue over 256 characters', async () => {
      const errors = await validate(build({ venue: 'a'.repeat(257) }));
      expect(errors.some((e) => e.property === 'venue')).toBe(true);
    });

    it('accepts a venue at exactly 256 characters', async () => {
      const errors = await validate(build({ venue: 'a'.repeat(256) }));
      expect(errors).toHaveLength(0);
    });
  });
});
