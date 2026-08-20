// Decorator metadata is normally set up by the Nest bootstrap; an isolated unit
// spec has to pull it in itself.
import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import { IsDate, IsOptional, validateSync } from 'class-validator';
import { IsAfter } from './is-after.decorator';

class Range {
  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @IsAfter('startsAt')
  endsAt?: Date;
}

const errorsFor = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(Range, payload));

const hasIsAfterError = (payload: Record<string, unknown>) =>
  errorsFor(payload).some((e) => e.constraints?.isAfter !== undefined);

describe('IsAfter', () => {
  it('rejects an end date before the start date', () => {
    expect(
      hasIsAfterError({
        startsAt: '2026-01-02T00:00:00Z',
        endsAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe(true);
  });

  it('rejects an end date equal to the start date, since the range must be non-empty', () => {
    expect(
      hasIsAfterError({
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe(true);
  });

  it('accepts an end date after the start date', () => {
    expect(
      hasIsAfterError({
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2026-01-02T00:00:00Z',
      }),
    ).toBe(false);
  });

  it('accepts an omitted end date so it composes with @IsOptional', () => {
    expect(hasIsAfterError({ startsAt: '2026-01-01T00:00:00Z' })).toBe(false);
  });

  it('leaves an unparseable date to @IsDate rather than reporting it twice', () => {
    expect(
      hasIsAfterError({ startsAt: '2026-01-01T00:00:00Z', endsAt: 'not-a-date' }),
    ).toBe(false);
  });
});
