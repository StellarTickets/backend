import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Express middleware that generates or accepts an X-Request-Id header,
 * attaching it to req, req.headers, and res headers.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existing = req.header(REQUEST_ID_HEADER);
  const id =
    existing && existing.trim().length > 0 ? existing.trim() : randomUUID();

  req.headers[REQUEST_ID_HEADER.toLowerCase()] = id;
  (req as unknown as { id: string }).id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    requestIdMiddleware(req, res, next);
  }
}
