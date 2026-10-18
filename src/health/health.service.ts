import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  /** Terminus-style RPC health indicator (#147): up/down plus latency. */
  async getRpc() {
    const { up, latencyMs } = await this.stellar.pingRpc();
    if (!up) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        status: 'down',
        latencyMs,
        message: 'Soroban RPC unreachable',
      });
    }
    return { status: 'up', latencyMs };
  }

  getHealth() {
    return { status: 'ok', service: 'stellar-tickets-backend' };
  }

  getLive() {
    return { status: 'ok' };
  }

  async getReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        status: 'error',
        database: 'disconnected',
        message: 'Database connection failed',
      });
    }
  }
}
