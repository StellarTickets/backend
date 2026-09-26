import 'dotenv/config';
import { startTracing } from './tracing';

async function bootstrap() {
  // Instrumentation must start before Nest and Express are loaded.
  const tracing = startTracing();
  const [
    { NestFactory },
    { AppModule },
    { ValidationPipe, VersioningType },
    { ConfigService },
    { default: helmet },
  ] = await Promise.all([
    import('@nestjs/core'),
    import('./app.module.js'),
    import('@nestjs/common'),
    import('@nestjs/config'),
    import('helmet'),
  ]);
  const app = await NestFactory.create(AppModule);
  if (tracing) app.enableShutdownHooks();
  const config = app.get(ConfigService);

  const cspDirectives = config.get<string>('CSP_DIRECTIVES');
  const helmetOptions: Record<string, unknown> = {};
  if (cspDirectives) {
    try {
      helmetOptions.contentSecurityPolicy = {
        directives: JSON.parse(cspDirectives) as Record<string, string[]>,
      };
    } catch {
      helmetOptions.contentSecurityPolicy = true;
    }
  }
  app.use(helmet(helmetOptions));

  const bodyLimit = config.get<string>('JSON_BODY_LIMIT', '100kb');
  const express = await import('express');
  app.use(express.json({ limit: bodyLimit }));

  app.enableCors({
    origin: config.getOrThrow<string>('APP_URL'),
    credentials: true,
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
