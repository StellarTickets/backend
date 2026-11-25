import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ScannerDevicesService } from './scanner-devices.service';
import type { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { StellarService } from '../stellar/stellar.service';

describe('ScannerDevicesService', () => {
  let service: ScannerDevicesService;
  let prisma: {
    event: { findUnique: jest.Mock };
    scannerDevice: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let organizations: OrganizationsService;
  let assertMember: jest.SpyInstance;
  let stellar: Record<string, jest.Mock>;

  beforeEach(() => {
    prisma = {
      event: { findUnique: jest.fn() },
      scannerDevice: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    organizations = new OrganizationsService(
      prisma as unknown as PrismaService,
    );
    assertMember = jest
      .spyOn(organizations, 'assertMember')
      .mockResolvedValue(undefined);
    stellar = {
      buildAddCheckinSignerTx: jest.fn().mockResolvedValue('unsigned-add'),
      buildRemoveCheckinSignerTx: jest
        .fn()
        .mockResolvedValue('unsigned-remove'),
      decodeSignedInvocation: jest.fn(),
      submitSignedTransaction: jest.fn().mockResolvedValue({ txHash: 'h' }),
      isCheckinSigner: jest.fn(),
    };
    service = new ScannerDevicesService(
      prisma as unknown as PrismaService,
      organizations,
      stellar as unknown as StellarService,
    );
  });

  describe('register', () => {
    it('returns the raw token exactly once and persists only its hash', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
      });
      prisma.scannerDevice.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'device-1', ...data }),
      );

      const { device, token } = await service.register('user-1', 'event-1', {
        name: 'Gate A Scanner',
      });

      expect(token).toMatch(/^scn_[a-f0-9]{64}$/);
      expect(device.tokenHash).not.toBe(token);
      expect(device.tokenHash).toHaveLength(64);
    });
  });

  describe('authenticate', () => {
    it('rejects an unknown token', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(null);

      await expect(service.authenticate('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a revoked token', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue({
        id: 'device-1',
        revokedAt: new Date(),
      });

      await expect(
        service.authenticate('revoked-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.scannerDevice.update).not.toHaveBeenCalled();
    });

    it('accepts a live token and bumps lastUsedAt', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue({
        id: 'device-1',
        revokedAt: null,
      });

      const device = await service.authenticate('good-token');

      expect(device.id).toBe('device-1');
      expect(prisma.scannerDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'device-1' } }),
      );
    });
  });

  describe('revoke', () => {
    it('sets revokedAt so the token stops authenticating', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue({
        id: 'device-1',
        eventId: 'event-1',
        event: { organizationId: 'org-1' },
      });

      await service.revoke('user-1', 'event-1', 'device-1');

      expect(prisma.scannerDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('check-in signer key (#515)', () => {
    const DEVICE_KEY = 'G' + 'D'.repeat(55);
    const device = (over: Record<string, unknown> = {}) => ({
      id: 'device-1',
      eventId: 'event-1',
      stellarPublicKey: DEVICE_KEY,
      revokedAt: null,
      signerRegisteredAt: null,
      event: {
        id: 'event-1',
        organizationId: 'org-1',
        chainEventId: 42n,
        deletedAt: null,
        organization: { stellarAccount: 'GORGANIZER' },
      },
      ...over,
    });

    it('stores the device key when registering', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
      });
      prisma.scannerDevice.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'device-1', ...data }),
      );

      await service.register('user-1', 'event-1', {
        name: 'Gate A',
        stellarPublicKey: DEVICE_KEY,
      });

      expect(prisma.scannerDevice.create).toHaveBeenCalledWith({
        // expect.* matchers are typed `any`; the rule can't see through them.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ stellarPublicKey: DEVICE_KEY }),
      });
    });

    it('builds add_checkin_signer for the organizer to sign', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(device());

      const result = await service.buildSignerTx(
        'user-1',
        'event-1',
        'device-1',
        'add',
      );

      expect(result).toEqual({ unsignedXdr: 'unsigned-add' });
      expect(assertMember).toHaveBeenCalledWith('org-1', 'user-1');
      expect(stellar.buildAddCheckinSignerTx).toHaveBeenCalledWith({
        organizerPublicKey: 'GORGANIZER',
        chainEventId: 42n,
        signerPublicKey: DEVICE_KEY,
      });
    });

    it('records the signer only once the chain reports it registered', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(device());
      stellar.decodeSignedInvocation.mockReturnValue({
        functionName: 'add_checkin_signer',
        args: ['GORGANIZER', 42n, DEVICE_KEY],
      });
      stellar.isCheckinSigner.mockResolvedValue(true);

      await service.confirmSigner(
        'user-1',
        'event-1',
        'device-1',
        'add',
        'signed',
      );

      expect(stellar.submitSignedTransaction).toHaveBeenCalledWith('signed');
      expect(stellar.isCheckinSigner).toHaveBeenCalledWith(42n, DEVICE_KEY);
      expect(prisma.scannerDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { signerRegisteredAt: expect.any(Date) },
      });
    });

    it('refuses to record a signer the chain does not show', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(device());
      stellar.decodeSignedInvocation.mockReturnValue({
        functionName: 'add_checkin_signer',
        args: ['GORGANIZER', 42n, DEVICE_KEY],
      });
      stellar.isCheckinSigner.mockResolvedValue(false);

      await expect(
        service.confirmSigner('user-1', 'event-1', 'device-1', 'add', 'signed'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.scannerDevice.update).not.toHaveBeenCalled();
    });

    it('rejects an envelope for a different signer, before submitting', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(device());
      stellar.decodeSignedInvocation.mockReturnValue({
        functionName: 'add_checkin_signer',
        args: ['GORGANIZER', 42n, 'G' + 'X'.repeat(55)],
      });

      await expect(
        service.confirmSigner('user-1', 'event-1', 'device-1', 'add', 'signed'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stellar.submitSignedTransaction).not.toHaveBeenCalled();
    });

    it('clears the signer after remove_checkin_signer, even for a revoked device', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(
        device({ revokedAt: new Date(), signerRegisteredAt: new Date() }),
      );
      stellar.decodeSignedInvocation.mockReturnValue({
        functionName: 'remove_checkin_signer',
        args: ['GORGANIZER', 42n, DEVICE_KEY],
      });
      stellar.isCheckinSigner.mockResolvedValue(false);

      await service.confirmSigner(
        'user-1',
        'event-1',
        'device-1',
        'remove',
        'signed',
      );

      expect(prisma.scannerDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        data: { signerRegisteredAt: null },
      });
    });

    it('will not add a signer for a revoked device or one without a key', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(
        device({ revokedAt: new Date() }),
      );
      await expect(
        service.buildSignerTx('user-1', 'event-1', 'device-1', 'add'),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.scannerDevice.findUnique.mockResolvedValue(
        device({ stellarPublicKey: null }),
      );
      await expect(
        service.buildSignerTx('user-1', 'event-1', 'device-1', 'add'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stellar.buildAddCheckinSignerTx).not.toHaveBeenCalled();
    });

    it('treats a device from another event as not found', async () => {
      prisma.scannerDevice.findUnique.mockResolvedValue(
        device({ eventId: 'event-2' }),
      );
      await expect(
        service.buildSignerTx('user-1', 'event-1', 'device-1', 'add'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
