import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { MetricsService } from './metrics.service';

export function createHttpMetricsMiddleware(
  metrics: MetricsService,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const routeInfo: unknown = request.route;
      const routePath =
        typeof routeInfo === 'object' &&
        routeInfo !== null &&
        'path' in routeInfo
          ? routeInfo.path
          : undefined;
      const route =
        typeof routePath === 'string'
          ? normalizeRoute(`${request.baseUrl}${routePath}`)
          : 'unmatched';
      const durationSeconds =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

      metrics.recordRequest(
        normalizeMethod(request.method),
        route,
        response.statusCode,
        durationSeconds,
      );
    });

    next();
  };
}

function normalizeMethod(method: string): string {
  const normalized = method.toUpperCase();
  return [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'TRACE',
    'CONNECT',
  ].includes(normalized)
    ? normalized
    : 'OTHER';
}

function normalizeRoute(path: string): string {
  const normalized = `/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized.replace(/:([^/]+)/g, ':param') || '/';
}
