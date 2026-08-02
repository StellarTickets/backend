import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { IssueTicketDto } from './dto/issue-ticket.dto';
import { ConfirmIssueTicketDto } from './dto/confirm-issue-ticket.dto';
import { PurchasePrimaryDto } from './dto/purchase-primary.dto';
import { ConfirmPurchasePrimaryDto } from './dto/confirm-purchase-primary.dto';
import { TransferTicketDto } from './dto/transfer-ticket.dto';
import { ConfirmTransferTicketDto } from './dto/confirm-transfer-ticket.dto';
import { ConfirmSignedTxDto } from './dto/confirm-signed-tx.dto';
import { ListForResaleDto } from './dto/list-for-resale.dto';
import { ConfirmListForResaleDto } from './dto/confirm-list-for-resale.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('resale')
  findActiveResaleListings() {
    return this.ticketsService.findActiveResaleListings();
  }

  @Get('mine')
  findMine(@CurrentUser() user: CurrentUserPayload) {
    return this.ticketsService.findMine(user.userId);
  }

  @Get('verify/:qrSecret')
  verify(
    @CurrentUser() user: CurrentUserPayload,
    @Param('qrSecret') qrSecret: string,
  ) {
    return this.ticketsService.verify(user.userId, qrSecret);
  }

  @Post('issue')
  buildIssueTx(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: IssueTicketDto,
  ) {
    return this.ticketsService.buildIssueTx(
      user.userId,
      dto.ticketTypeId,
      dto.toUserId,
      dto.seat,
    );
  }

  @Post('confirm-issue')
  confirmIssue(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmIssueTicketDto,
  ) {
    return this.ticketsService.confirmIssue(
      user.userId,
      dto.ticketTypeId,
      dto.toUserId,
      dto.seat,
      dto.signedXdr,
    );
  }

  @Post('purchase')
  buildPurchaseTx(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PurchasePrimaryDto,
  ) {
    return this.ticketsService.buildPurchaseTx(
      user.userId,
      dto.ticketTypeId,
      dto.seat,
    );
  }

  @Post('confirm-purchase')
  confirmPurchase(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmPurchasePrimaryDto,
  ) {
    return this.ticketsService.confirmPurchase(
      user.userId,
      dto.ticketTypeId,
      dto.seat,
      dto.signedXdr,
    );
  }

  @Post(':ticketId/transfer')
  buildTransferTx(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: TransferTicketDto,
  ) {
    return this.ticketsService.buildTransferTx(
      user.userId,
      ticketId,
      dto.toUserId,
    );
  }

  @Post(':ticketId/confirm-transfer')
  confirmTransfer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmTransferTicketDto,
  ) {
    return this.ticketsService.confirmTransfer(
      user.userId,
      ticketId,
      dto.toUserId,
      dto.signedXdr,
    );
  }

  @Post(':ticketId/check-in')
  buildCheckInTx(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.buildCheckInTx(user.userId, ticketId);
  }

  @Post(':ticketId/confirm-check-in')
  confirmCheckIn(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmSignedTxDto,
  ) {
    return this.ticketsService.confirmCheckIn(
      user.userId,
      ticketId,
      dto.signedXdr,
    );
  }

  @Post(':ticketId/revoke')
  buildRevokeTx(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.buildRevokeTx(user.userId, ticketId);
  }

  @Post(':ticketId/confirm-revoke')
  confirmRevoke(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmSignedTxDto,
  ) {
    return this.ticketsService.confirmRevoke(
      user.userId,
      ticketId,
      dto.signedXdr,
    );
  }

  @Post(':ticketId/list-resale')
  buildListForResaleTx(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ListForResaleDto,
  ) {
    return this.ticketsService.buildListForResaleTx(
      user.userId,
      ticketId,
      dto.price,
    );
  }

  @Post(':ticketId/confirm-list-resale')
  confirmListForResale(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmListForResaleDto,
  ) {
    return this.ticketsService.confirmListForResale(
      user.userId,
      ticketId,
      dto.price,
      dto.signedXdr,
    );
  }

  @Post(':ticketId/cancel-resale')
  buildCancelResaleTx(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.buildCancelResaleTx(user.userId, ticketId);
  }

  @Post(':ticketId/confirm-cancel-resale')
  confirmCancelResale(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmSignedTxDto,
  ) {
    return this.ticketsService.confirmCancelResale(
      user.userId,
      ticketId,
      dto.signedXdr,
    );
  }

  @Post(':ticketId/buy-resale')
  buildBuyResaleTx(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.buildBuyResaleTx(user.userId, ticketId);
  }

  @Post(':ticketId/confirm-buy-resale')
  confirmBuyResale(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmSignedTxDto,
  ) {
    return this.ticketsService.confirmBuyResale(
      user.userId,
      ticketId,
      dto.signedXdr,
    );
  }
}
