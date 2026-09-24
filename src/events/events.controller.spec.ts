import { HEADERS_METADATA } from '@nestjs/common/constants';
import { EventsController } from './events.controller';
import type { EventsService } from './events.service';
import type { ListOrganizationEventsQueryDto } from './dto/list-organization-events-query.dto';

describe('EventsController', () => {
  it('adds cache-control headers to public event listings', () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      EventsController.prototype.findPublished,
    ) as Array<{ name: string; value: string }>;

    expect(headers).toContainEqual({
      name: 'Cache-Control',
      value: 'public, max-age=60, s-maxage=300',
    });
  });

  it('passes the status filter and pagination through to the organization listing', async () => {
    const page = { items: [], total: 0, page: 2, limit: 5 };
    const eventsService = {
      findForOrganization: jest.fn().mockResolvedValue(page),
    };
    const controller = new EventsController(
      eventsService as unknown as EventsService,
    );
    const query = {
      status: 'DRAFT',
      page: 2,
      limit: 5,
    } as ListOrganizationEventsQueryDto;

    const result = await controller.findForOrganization(
      { userId: 'user-1' } as never,
      'org-1',
      query,
    );

    expect(eventsService.findForOrganization).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      query,
    );
    expect(result).toBe(page);
  });
});
