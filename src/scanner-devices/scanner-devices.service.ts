import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { StellarService } from '../stellar/stellar.service';
import { RegisterScannerDeviceDto } from './dto/register-scanner-device.dto';

const TOKEN_PREFIX = 'scn';

/** #515 — adding or removing a device's on-chain check-in signing right. */
export type SignerAction = 'add' | 'remove';

const SIGNER_FN: Record<SignerAction, string> = {
  add: 'add_checkin_signer',
  remove: 'remove_checkin_signer',
};

@Injectable()
export class ScannerDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly stellar: StellarService,
  ) {}

  /** Registers a device and returns its raw bearer token once -- only the hash is persisted. */
  async register(
    userId: string,
    eventId: string,
    dto: RegisterScannerDeviceDto,
  ) {
    await this.organizations.findEventForMember(eventId, userId);

    const token = `${TOKEN_PREFIX}_${randomBytes(32).toString('hex')}`;
    const device = await this.prisma.scannerDevice.create({
      data: {
        eventId,
        name: dto.name,
        tokenHash: this.hash(token),
        stellarPublicKey: dto.stellarPublicKey ?? null,
      },
    });
    return { device, token };
  }

  async listForEvent(userId: string, eventId: string) {
    await this.organizations.findEventForMember(eventId, userId);

    return this.prisma.scannerDevice.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(userId: string, eventId: string, deviceId: string) {
    const device = await this.prisma.scannerDevice.findUnique({
      where: { id: deviceId },
      include: { event: true },
    });
    if (!device || device.eventId !== eventId) {
      throw new NotFoundException('Scanner device not found');
    }
    await this.organizations.assertMember(device.event.organizationId, userId);
    return this.prisma.scannerDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * #515 — builds the organizer-signed call that adds (or removes) the
   * device's key as a check-in signer for the event.
   */
  async buildSignerTx(
    userId: string,
    eventId: string,
    deviceId: string,
    action: SignerAction,
  ) {
    const { device, event } = await this.loadDeviceForSigner(
      userId,
      eventId,
      deviceId,
      action,
    );
    const params = {
      organizerPublicKey: event.organization.stellarAccount,
      chainEventId: event.chainEventId,
      signerPublicKey: device.stellarPublicKey,
    };
    const unsignedXdr =
      action === 'add'
        ? await this.stellar.buildAddCheckinSignerTx(params)
        : await this.stellar.buildRemoveCheckinSignerTx(params);
    return { unsignedXdr };
  }

  /**
   * #515 — relays the organizer-signed call, then records the result the
   * chain reports (`is_checkin_signer`), not the one requested.
   */
  async confirmSigner(
    userId: string,
    eventId: string,
    deviceId: string,
    action: SignerAction,
    signedXdr: string,
  ) {
    const { device, event } = await this.loadDeviceForSigner(
      userId,
      eventId,
      deviceId,
      action,
    );
    this.assertSignerInvocation(signedXdr, SIGNER_FN[action], [
      event.organization.stellarAccount,
      event.chainEventId,
      device.stellarPublicKey,
    ]);
    await this.stellar.submitSignedTransaction(signedXdr);
    const registered = await this.stellar.isCheckinSigner(
      event.chainEventId,
      device.stellarPublicKey,
    );
    if (registered !== (action === 'add')) {
      throw new ConflictException(
        `The chain does not show the device signer as ${action === 'add' ? 'added' : 'removed'}`,
      );
    }
    return this.prisma.scannerDevice.update({
      where: { id: deviceId },
      data: { signerRegisteredAt: registered ? new Date() : null },
    });
  }

  private async loadDeviceForSigner(
    userId: string,
    eventId: string,
    deviceId: string,
    action: SignerAction,
  ) {
    const device = await this.prisma.scannerDevice.findUnique({
      where: { id: deviceId },
      include: { event: { include: { organization: true } } },
    });
    if (!device || device.eventId !== eventId || device.event.deletedAt) {
      throw new NotFoundException('Scanner device not found');
    }
    await this.organizations.assertMember(device.event.organizationId, userId);
    if (!device.stellarPublicKey) {
      throw new BadRequestException(
        'This device has no Stellar public key; register one first',
      );
    }
    // A revoked device may only lose its signing right, never gain it.
    if (action === 'add' && device.revokedAt) {
      throw new BadRequestException('This scanner device is revoked');
    }
    const { chainEventId } = device.event;
    if (chainEventId === null) {
      throw new BadRequestException('The event is not published on chain yet');
    }
    return {
      device: { ...device, stellarPublicKey: device.stellarPublicKey },
      event: { ...device.event, chainEventId },
    };
  }

  private assertSignerInvocation(
    signedXdr: string,
    fn: string,
    expectedArgs: unknown[],
  ) {
    let invocation: { functionName: string; args: unknown[] };
    try {
      invocation = this.stellar.decodeSignedInvocation(signedXdr);
    } catch (err) {
      throw new BadRequestException(
        `Signed transaction could not be decoded: ${(err as Error).message}`,
      );
    }
    if (invocation.functionName !== fn) {
      throw new BadRequestException(
        `Signed transaction calls ${invocation.functionName}, expected ${fn}`,
      );
    }
    expectedArgs.forEach((value, index) => {
      if (invocation.args[index] !== value) {
        throw new BadRequestException(
          'Signed transaction does not match this device and event',
        );
      }
    });
  }

  /** Validates a raw bearer token, returning the live (non-revoked) device it belongs to. */
  async authenticate(token: string) {
    const device = await this.prisma.scannerDevice.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!device || device.revokedAt) {
      throw new UnauthorizedException(
        'Invalid or revoked scanner device token',
      );
    }
    await this.prisma.scannerDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });
    return device;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
