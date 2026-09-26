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

  app.use(helmet());
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
