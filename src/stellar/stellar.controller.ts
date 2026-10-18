import { Controller, Get, Param } from '@nestjs/common';
import { StellarService } from './stellar.service';

@Controller('stellar')
export class StellarController {
  constructor(private readonly stellar: StellarService) {}

  @Get('circuit-breaker/metrics')
  getCircuitBreakerMetrics() {
    return this.stellar.getCircuitBreakerMetrics();
  }

  @Get('transactions/:hash/status')
  getTransactionStatus(@Param('hash') hash: string) {
    return this.stellar.getTransactionStatus(hash);
  }
}
