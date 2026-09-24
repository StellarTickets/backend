import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  PaginationQueryDto,
} from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  it('defaults to the first page of 20', async () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(DEFAULT_PAGE_LIMIT).toBe(20);
  });

  it('converts query-string values to numbers', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '3', limit: '50' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 3, limit: 50 });
  });

  it('accepts the maximum limit', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      limit: String(MAX_PAGE_LIMIT),
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    ['limit', String(MAX_PAGE_LIMIT + 1)],
    ['limit', '0'],
    ['limit', '2.5'],
    ['limit', 'ten'],
    ['page', '0'],
    ['page', '-1'],
    ['page', '1.5'],
  ])('rejects %s=%s', async (property, value) => {
    const dto = plainToInstance(PaginationQueryDto, { [property]: value });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain(property);
  });
});
