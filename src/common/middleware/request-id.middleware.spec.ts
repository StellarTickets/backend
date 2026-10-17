import type { Request, Response } from 'express';
import {
  requestIdMiddleware,
  RequestIdMiddleware,
  REQUEST_ID_HEADER,
} from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;
  const headersSet: Record<string, string> = {};

  beforeEach(() => {
    headersSet['X-Request-Id'] = '';
    mockReq = {
      header: jest.fn((name: string) => {
        if (name.toLowerCase() === 'x-request-id') {
          return mockReq.headers?.['x-request-id'] as string;
        }
        return undefined;
      }),
      headers: {},
    };
    mockRes = {
      setHeader: jest.fn((name: string, value: string) => {
        headersSet[name] = value;
        return mockRes as Response;
      }),
    };
    nextFn = jest.fn();
  });

  it('generates a UUID when no X-Request-Id header is supplied', () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    const generatedId = (mockReq as unknown as { id: string }).id;
    expect(generatedId).toBeDefined();
    expect(typeof generatedId).toBe('string');
    expect(generatedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(mockReq.headers?.['x-request-id']).toBe(generatedId);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      generatedId,
    );
    expect(nextFn).toHaveBeenCalled();
  });

  it('preserves and accepts an incoming X-Request-Id header', () => {
    mockReq.headers = { 'x-request-id': 'client-provided-id-999' };

    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect((mockReq as unknown as { id: string }).id).toBe(
      'client-provided-id-999',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'client-provided-id-999',
    );
    expect(nextFn).toHaveBeenCalled();
  });

  it('works via the class-based NestMiddleware wrapper', () => {
    const middleware = new RequestIdMiddleware();
    mockReq.headers = { 'x-request-id': 'nest-middleware-id' };

    middleware.use(mockReq as Request, mockRes as Response, nextFn);

    expect((mockReq as unknown as { id: string }).id).toBe(
      'nest-middleware-id',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'nest-middleware-id',
    );
    expect(nextFn).toHaveBeenCalled();
  });
});
