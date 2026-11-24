import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { ScannerDevice } from '@prisma/client';
import { ScannerDeviceGuard } from './guards/scanner-device.guard';
import { TicketsService } from '../tickets/tickets.service';
import { ConfirmCheckInDto } from '../tickets/dto/confirm-check-in.dto';

type DeviceRequest = Request & { scannerDevice: ScannerDevice };

/** Device-token authenticated check-in path -- no staff JWT needed. */
@Controller('tickets')
@UseGuards(ScannerDeviceGuard)
export class ScannerCheckInController {
  constructor(private readonly ticketsService: TicketsService) {}

  /** #515 — an unsigned `check_in` for the device to sign with its own key. */
  @Post(':ticketId/scanner-check-in/build')
  buildCheckIn(
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmCheckInDto,
    @Req() req: DeviceRequest,
  ) {
    return this.ticketsService.buildCheckInTxByDevice(
      ticketId,
      req.scannerDevice,
      dto.gateId,
    );
  }

  @Post(':ticketId/scanner-check-in')
  confirmCheckIn(
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmCheckInDto,
    @Req() req: DeviceRequest,
  ) {
    return this.ticketsService.confirmCheckInByDevice(
      ticketId,
      dto.signedXdr,
      dto.gateId,
      undefined,
      req.scannerDevice,
    );
  }
}
