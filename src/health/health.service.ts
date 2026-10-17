import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

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
