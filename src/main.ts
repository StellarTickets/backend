import 'dotenv/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { startTracing } from './tracing';

async function bootstrap() {
  // Instrumentation must start before Nest and Express are loaded.
  const tracing = startTracing();
  const [
    { NestFactory },
    { AppModule },
    { ConfigService },
    { DocumentBuilder, SwaggerModule },
    { GlobalExceptionFilter },
    { configureApp },
    { Logger: PinoLogger },
    { MetricsService },
  ] = await Promise.all([
    import('@nestjs/core'),
    import('./app.module.js'),
    import('@nestjs/config'),
    import('@nestjs/swagger'),
    import('./common/filters/global-exception.filter.js'),
    import('./app.setup.js'),
    import('nestjs-pino'),
    import('./common/metrics/metrics.service.js'),
  ]);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  if (tracing) app.enableShutdownHooks();
  const config = app.get(ConfigService);

  app.useLogger(app.get(PinoLogger));
  configureApp(app, config, app.get(MetricsService));

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
