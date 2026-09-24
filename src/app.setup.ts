import { ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { parseTrustProxy } from './config/trust-proxy';

/**
 * HTTP-level app configuration, shared by `main.ts` and the HTTP specs so
 * tests exercise the same middleware and Express settings as production.
 */
export function configureApp(
  app: NestExpressApplication,
  config: ConfigService,
): void {
  // Resolve `req.ip` from X-Forwarded-For only for proxies we trust —
  // see docs/DEPLOYMENT.md.
  app.set('trust proxy', parseTrustProxy(config.get<string>('TRUST_PROXY')));
  // Weak ETags on GET responses; Express answers a matching
  // If-None-Match with 304 Not Modified. See docs/API.md.
  app.set('etag', 'weak');

  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('APP_URL'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
