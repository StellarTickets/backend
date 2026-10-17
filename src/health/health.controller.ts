import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('live')
  getLive() {
    return this.healthService.getLive();
  }

  @Get('ready')
  getReady() {
    return this.healthService.getReady();
  }

  @Get('rpc')
  getRpc() {
    return this.healthService.getRpc();
  }
}
