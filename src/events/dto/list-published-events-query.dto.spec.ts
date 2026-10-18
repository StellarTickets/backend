import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPublishedEventsQueryDto } from './list-published-events-query.dto';

const build = (query: Record<string, string>) =>
  plainToInstance(ListPublishedEventsQueryDto, query);

const failingProperties = async (query: Record<string, string>) =>
  (await validate(build(query))).map((e) => e.property);

describe('ListPublishedEventsQueryDto', () => {
  it('accepts an empty query so the listing stays unfiltered', async () => {
    const dto = build({});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
    expect(dto.q).toBeUndefined();
    expect(dto.category).toBeUndefined();
    expect(dto.from).toBeUndefined();
    expect(dto.to).toBeUndefined();
  });

  describe('q', () => {
    it('trims the search text', async () => {
      const dto = build({ q: '  jazz  ' });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.q).toBe('jazz');
    });

    it('rejects whitespace-only text', async () => {
      expect(await failingProperties({ q: '   ' })).toEqual(['q']);
    });

    it('rejects text longer than 100 characters', async () => {
      expect(await failingProperties({ q: 'a'.repeat(101) })).toEqual(['q']);
    });
  });

  describe('category', () => {
    it('accepts a known category', async () => {
      const dto = build({ category: 'CONCERTS' });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.category).toBe('CONCERTS');
    });

    it('rejects an unknown category and lists the allowed values', async () => {
      const [error] = await validate(build({ category: 'PARTIES' }));
      expect(error.property).toBe('category');
      expect(Object.values(error.constraints ?? {})[0]).toContain(
        'category must be one of',
      );
    });
  });

  describe('from / to', () => {
    it('parses ISO 8601 dates', async () => {
      const dto = build({
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-30T23:59:59.000Z',
      });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.from).toEqual(new Date('2026-11-01T00:00:00.000Z'));
      expect(dto.to).toEqual(new Date('2026-11-30T23:59:59.000Z'));
    });

    it('accepts either bound on its own', async () => {
      expect(await failingProperties({ from: '2026-11-01' })).toEqual([]);
      expect(await failingProperties({ to: '2026-11-01' })).toEqual([]);
    });

    it('rejects unparseable dates', async () => {
      expect(await failingProperties({ from: 'soon' })).toEqual(['from']);
      expect(await failingProperties({ to: 'later' })).toEqual(['to']);
    });

    it('rejects a range whose end is before its start', async () => {
      const [error] = await validate(
        build({ from: '2026-11-02', to: '2026-11-01' }),
      );
      expect(error.property).toBe('to');
      expect(error.constraints).toEqual({
        isNotBefore: 'to must not be before from',
      });
    });

    it('accepts a range where from equals to', async () => {
      expect(
        await failingProperties({ from: '2026-11-01', to: '2026-11-01' }),
      ).toEqual([]);
    });
  });
});
