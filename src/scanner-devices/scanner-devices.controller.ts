import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ScannerDevicesService } from './scanner-devices.service';
import { RegisterScannerDeviceDto } from './dto/register-scanner-device.dto';
import { ConfirmDeviceSignerDto } from './dto/confirm-device-signer.dto';

@Controller('events/:eventId/scanner-devices')
@UseGuards(JwtAuthGuard)
export class ScannerDevicesController {
  constructor(private readonly scannerDevices: ScannerDevicesService) {}

  @Post()
  register(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
    @Body() dto: RegisterScannerDeviceDto,
  ) {
    return this.scannerDevices.register(user.userId, eventId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
  ) {
    return this.scannerDevices.listForEvent(user.userId, eventId);
  }

  /** #515 — builds `add_checkin_signer` for the device's key (organizer signs). */
  @Post(':deviceId/signer')
  buildAddSigner(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.scannerDevices.buildSignerTx(
      user.userId,
      eventId,
      deviceId,
      'add',
    );
  }

  @Post(':deviceId/confirm-signer')
  confirmAddSigner(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: ConfirmDeviceSignerDto,
  ) {
    return this.scannerDevices.confirmSigner(
      user.userId,
      eventId,
      deviceId,
      'add',
      dto.signedXdr,
    );
  }

  /** #515 — builds `remove_checkin_signer`, e.g. after revoking a lost device. */
  @Post(':deviceId/remove-signer')
  buildRemoveSigner(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.scannerDevices.buildSignerTx(
      user.userId,
      eventId,
      deviceId,
      'remove',
    );
  }

  @Post(':deviceId/confirm-remove-signer')
  confirmRemoveSigner(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: ConfirmDeviceSignerDto,
  ) {
    return this.scannerDevices.confirmSigner(
      user.userId,
      eventId,
      deviceId,
      'remove',
      dto.signedXdr,
    );
  }

  @Patch(':deviceId/revoke')
  revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.scannerDevices.revoke(user.userId, eventId, deviceId);
  }
}
