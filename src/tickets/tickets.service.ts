import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ResaleListingStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly stellar: StellarService,
  ) {}

  // ---- Organizer-authorized issuance (off-chain payment already settled) ----

  async buildIssueTx(
    userId: string,
    ticketTypeId: string,
    toUserId: string,
    seat?: string,
  ) {
    const { ticketType, event } =
      await this.getTicketTypeWithEvent(ticketTypeId);
    await this.organizations.assertMember(event.organizationId, userId);
    this.assertHasCapacity(ticketType.quantityIssued, ticketType.quantityTotal);
    if (event.chainEventId === null) {
      throw new BadRequestException(
        'Event has not been published on-chain yet',
      );
    }

    const toUser = await this.getUserWithWallet(toUserId);
    const unsignedXdr = await this.stellar.buildIssueTicketTx({
      organizerPublicKey: event.organization.stellarAccount,
      chainEventId: event.chainEventId,
      toPublicKey: toUser.stellarPublicKey!,
      tier: ticketType.name,
      seat: seat ?? 'unassigned',
      price: ticketType.price,
    });
    return { unsignedXdr };
  }

  async confirmIssue(
    userId: string,
    ticketTypeId: string,
    toUserId: string,
    seat: string | undefined,
    signedXdr: string,
  ) {
    const { event } = await this.getTicketTypeWithEvent(ticketTypeId);
    await this.organizations.assertMember(event.organizationId, userId);

    const { result, txHash } =
      await this.stellar.submitSignedTransaction(signedXdr);
    const chainTicketId = result as bigint;

    return this.prisma.$transaction(async (tx) => {
      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { quantityIssued: { increment: 1 } },
      });
      return tx.ticket.create({
        data: {
          eventId: event.id,
          ticketTypeId,
          ownerId: toUserId,
          chainTicketId,
          seat: seat ?? 'unassigned',
          issuedTxHash: txHash,
        },
      });
    });
  }

  // ---- Fully on-chain primary sale ----

  async buildPurchaseTx(buyerId: string, ticketTypeId: string, seat?: string) {
    const { ticketType, event } =
      await this.getTicketTypeWithEvent(ticketTypeId);
    this.assertHasCapacity(ticketType.quantityIssued, ticketType.quantityTotal);
    if (event.chainEventId === null) {
      throw new BadRequestException(
        'Event has not been published on-chain yet',
      );
    }
    const buyer = await this.getUserWithWallet(buyerId);

    const unsignedXdr = await this.stellar.buildPurchasePrimaryTx({
      buyerPublicKey: buyer.stellarPublicKey!,
      chainEventId: event.chainEventId,
      tier: ticketType.name,
      seat: seat ?? 'unassigned',
      price: ticketType.price,
    });
    return { unsignedXdr };
  }

  async confirmPurchase(
    buyerId: string,
    ticketTypeId: string,
    seat: string | undefined,
    signedXdr: string,
  ) {
    const { event } = await this.getTicketTypeWithEvent(ticketTypeId);
    const { result, txHash } =
      await this.stellar.submitSignedTransaction(signedXdr);
    const chainTicketId = result as bigint;

    return this.prisma.$transaction(async (tx) => {
      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { quantityIssued: { increment: 1 } },
      });
      return tx.ticket.create({
        data: {
          eventId: event.id,
          ticketTypeId,
          ownerId: buyerId,
          chainTicketId,
          seat: seat ?? 'unassigned',
          issuedTxHash: txHash,
        },
      });
    });
  }

  // ---- Direct transfer ----

  async buildTransferTx(userId: string, ticketId: string, toUserId: string) {
    const ticket = await this.getOwnedTicket(ticketId, userId);
    const owner = await this.getUserWithWallet(userId);
    const toUser = await this.getUserWithWallet(toUserId);

    const unsignedXdr = await this.stellar.buildTransferTicketTx({
      fromPublicKey: owner.stellarPublicKey!,
      chainTicketId: ticket.chainTicketId,
      toPublicKey: toUser.stellarPublicKey!,
    });
    return { unsignedXdr };
  }

  async confirmTransfer(
    userId: string,
    ticketId: string,
    toUserId: string,
    signedXdr: string,
  ) {
    await this.getOwnedTicket(ticketId, userId);
    await this.stellar.submitSignedTransaction(signedXdr);
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { ownerId: toUserId, status: TicketStatus.VALID },
    });
  }

  // ---- Verification (read-only, organizer/gate staff) ----

  async verify(userId: string, qrSecret: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrSecret },
      include: {
        event: { include: { organization: true } },
        owner: true,
        ticketType: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    await this.organizations.assertMember(ticket.event.organizationId, userId);

    const onChain = await this.stellar.verifyTicket(ticket.chainTicketId);
    const reconciledStatus = onChain.status.toUpperCase() as TicketStatus;
    if (reconciledStatus !== ticket.status) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: reconciledStatus },
      });
    }

    return {
      ticketId: ticket.id,
      eventName: ticket.event.name,
      tier: ticket.ticketType.name,
      seat: ticket.seat,
      ownerName: ticket.owner.name,
      status: reconciledStatus,
      onChainOwner: onChain.owner,
    };
  }

  // ---- Check-in ----

  async buildCheckInTx(userId: string, ticketId: string) {
    const ticket = await this.getTicketWithOrg(ticketId);
    await this.organizations.assertMember(ticket.event.organizationId, userId);

    const unsignedXdr = await this.stellar.buildCheckInTx({
      organizerPublicKey: ticket.event.organization.stellarAccount,
      chainTicketId: ticket.chainTicketId,
    });
    return { unsignedXdr };
  }

  async confirmCheckIn(userId: string, ticketId: string, signedXdr: string) {
    const ticket = await this.getTicketWithOrg(ticketId);
    await this.organizations.assertMember(ticket.event.organizationId, userId);
    await this.stellar.submitSignedTransaction(signedXdr);
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.USED, checkedInAt: new Date() },
    });
  }

  // ---- Revocation (fraud prevention) ----

  async buildRevokeTx(userId: string, ticketId: string) {
    const ticket = await this.getTicketWithOrg(ticketId);
    await this.organizations.assertMember(ticket.event.organizationId, userId);

    const unsignedXdr = await this.stellar.buildRevokeTicketTx({
      organizerPublicKey: ticket.event.organization.stellarAccount,
      chainTicketId: ticket.chainTicketId,
    });
    return { unsignedXdr };
  }

  async confirmRevoke(userId: string, ticketId: string, signedXdr: string) {
    const ticket = await this.getTicketWithOrg(ticketId);
    await this.organizations.assertMember(ticket.event.organizationId, userId);
    await this.stellar.submitSignedTransaction(signedXdr);
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.REVOKED },
    });
  }

  // ---- Resale marketplace ----

  async buildListForResaleTx(userId: string, ticketId: string, price: string) {
    const ticket = await this.getOwnedTicket(ticketId, userId);
    const owner = await this.getUserWithWallet(userId);

    const unsignedXdr = await this.stellar.buildListForResaleTx({
      ownerPublicKey: owner.stellarPublicKey!,
      chainTicketId: ticket.chainTicketId,
      price: BigInt(price),
    });
    return { unsignedXdr };
  }

  async confirmListForResale(
    userId: string,
    ticketId: string,
    price: string,
    signedXdr: string,
  ) {
    await this.getOwnedTicket(ticketId, userId);
    const { txHash } = await this.stellar.submitSignedTransaction(signedXdr);

    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.RESALE },
      });
      return tx.resaleListing.create({
        data: { ticketId, sellerId: userId, price: BigInt(price), txHash },
      });
    });
  }

  async buildCancelResaleTx(userId: string, ticketId: string) {
    const ticket = await this.getOwnedTicket(ticketId, userId);
    const owner = await this.getUserWithWallet(userId);

    const unsignedXdr = await this.stellar.buildCancelResaleTx({
      ownerPublicKey: owner.stellarPublicKey!,
      chainTicketId: ticket.chainTicketId,
    });
    return { unsignedXdr };
  }

  async confirmCancelResale(
    userId: string,
    ticketId: string,
    signedXdr: string,
  ) {
    await this.getOwnedTicket(ticketId, userId);
    await this.stellar.submitSignedTransaction(signedXdr);

    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.VALID },
      });
      await tx.resaleListing.updateMany({
        where: { ticketId, status: ResaleListingStatus.ACTIVE },
        data: { status: ResaleListingStatus.CANCELLED },
      });
    });
  }

  async buildBuyResaleTx(buyerId: string, ticketId: string) {
    const ticket = await this.getTicketWithOrg(ticketId);
    if (ticket.status !== TicketStatus.RESALE) {
      throw new BadRequestException('This ticket is not listed for resale');
    }
    const buyer = await this.getUserWithWallet(buyerId);

    const unsignedXdr = await this.stellar.buildBuyResaleTx({
      buyerPublicKey: buyer.stellarPublicKey!,
      chainTicketId: ticket.chainTicketId,
    });
    return { unsignedXdr };
  }

  async confirmBuyResale(buyerId: string, ticketId: string, signedXdr: string) {
    await this.stellar.submitSignedTransaction(signedXdr);

    return this.prisma.$transaction(async (tx) => {
      await tx.resaleListing.updateMany({
        where: { ticketId, status: ResaleListingStatus.ACTIVE },
        data: { status: ResaleListingStatus.SOLD },
      });
      return tx.ticket.update({
        where: { id: ticketId },
        data: { ownerId: buyerId, status: TicketStatus.VALID },
      });
    });
  }

  findActiveResaleListings() {
    return this.prisma.resaleListing.findMany({
      where: { status: ResaleListingStatus.ACTIVE },
      include: {
        ticket: { include: { event: true, ticketType: true } },
        seller: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findMine(userId: string) {
    return this.prisma.ticket.findMany({
      where: { ownerId: userId },
      include: { event: true, ticketType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- shared helpers ----

  private async getTicketTypeWithEvent(ticketTypeId: string) {
    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      include: { event: { include: { organization: true } } },
    });
    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }
    return { ticketType, event: ticketType.event };
  }

  private async getTicketWithOrg(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { event: { include: { organization: true } } },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private async getOwnedTicket(ticketId: string, userId: string) {
    const ticket = await this.getTicketWithOrg(ticketId);
    if (ticket.ownerId !== userId) {
      throw new ForbiddenException('You do not own this ticket');
    }
    return ticket;
  }

  private async getUserWithWallet(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.stellarPublicKey) {
      throw new BadRequestException(
        'Connect a Stellar wallet to your account before continuing',
      );
    }
    return user;
  }

  private assertHasCapacity(issued: number, total: number) {
    if (issued >= total) {
      throw new BadRequestException('This ticket type is sold out');
    }
  }
}
