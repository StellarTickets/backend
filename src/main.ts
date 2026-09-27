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
    { DocumentBuilder, SwaggerModule },
    { GlobalExceptionFilter },
  ] = await Promise.all([
    import('@nestjs/core'),
    import('./app.module.js'),
    import('@nestjs/common'),
    import('@nestjs/config'),
    import('helmet'),
    import('@nestjs/swagger'),
    import('./common/filters/global-exception.filter.js'),
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

  const corsOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: corsOrigins,
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

  app.useGlobalFilters(new GlobalExceptionFilter());

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Drips API')
      .setDescription('API for Drips ticketing platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
