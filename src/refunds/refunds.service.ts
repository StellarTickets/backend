import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Off-chain refund records for REVOKED primary-sale tickets (#141). */
@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
    if (ticket.status !== 'REVOKED') {
      throw new BadRequestException('Refunds are only available for REVOKED tickets');
    }
    return this.prisma.refund.create({ data: { ticketId } });
  }

  async complete(id: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException(`Refund ${id} not found`);
    return this.prisma.refund.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}
