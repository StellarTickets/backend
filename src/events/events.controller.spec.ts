import { HEADERS_METADATA } from '@nestjs/common/constants';
import { EventsController } from './events.controller';

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
});