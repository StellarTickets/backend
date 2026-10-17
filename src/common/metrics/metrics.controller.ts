import {
  Controller,
  Get,
  Header,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { MetricsService } from './metrics.service';

@Controller({ version: VERSION_NEUTRAL })
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  getMetrics(): string {
    return this.metrics.renderPrometheusMetrics();
  }
}
