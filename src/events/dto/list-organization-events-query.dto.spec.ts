import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventStatus } from '@prisma/client';
import { ListOrganizationEventsQueryDto } from './list-organization-events-query.dto';

describe('ListOrganizationEventsQueryDto', () => {
  it('accepts an empty query so the listing stays unfiltered', async () => {
    const dto = plainToInstance(ListOrganizationEventsQueryDto, {});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.status).toBeUndefined();
  });

  it.each(Object.values(EventStatus))('accepts status=%s', async (status) => {
    const dto = plainToInstance(ListOrganizationEventsQueryDto, { status });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.status).toBe(status);
  });

  it('rejects an unrecognized status and lists the allowed values', async () => {
    const dto = plainToInstance(ListOrganizationEventsQueryDto, {
      status: 'ARCHIVED',
    });
    const errors = await validate(dto);
    const statusError = errors.find((e) => e.property === 'status');

    expect(statusError).toBeDefined();
    const message = Object.values(statusError?.constraints ?? {})[0];
    expect(message).toContain('status must be one of');
    for (const value of Object.values(EventStatus)) {
      expect(message).toContain(value);
    }
  });

  it('rejects a lowercase status rather than guessing', async () => {
    const dto = plainToInstance(ListOrganizationEventsQueryDto, {
      status: 'draft',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
