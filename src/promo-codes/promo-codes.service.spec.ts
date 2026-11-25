import { BadRequestException } from '@nestjs/common';
import { PromoCodeDiscountType } from '@prisma/client';
import { PromoCodesService } from './promo-codes.service';
import type { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('PromoCodesService', () => {
  let service: PromoCodesService;
  let prisma: {
    event: { findUnique: jest.Mock };
    ticketType: { findUnique: jest.Mock };
    promoCode: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    promoCodeRedemption: { findUnique: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let organizations: OrganizationsService;

  beforeEach(() => {
    prisma = {
      event: { findUnique: jest.fn() },
      ticketType: { findUnique: jest.fn() },
      promoCode: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      promoCodeRedemption: { findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'pc-1' }]),
    };
    organizations = new OrganizationsService(
      prisma as unknown as PrismaService,
    );
    jest.spyOn(organizations, 'assertMember').mockResolvedValue(undefined);
    service = new PromoCodesService(
      prisma as unknown as PrismaService,
      organizations,
    );
  });

  describe('validate', () => {
    it('rejects an unknown code', async () => {
      prisma.promoCode.findUnique.mockResolvedValue(null);

      await expect(
        service.validate('event-1', 'user-1', 'NOPE', 1000n),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an inactive code', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: false,
      });

      await expect(
        service.validate('event-1', 'user-1', 'SAVE10', 1000n),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an expired code', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
        maxRedemptions: null,
        redemptionCount: 0,
      });

      await expect(
        service.validate('event-1', 'user-1', 'SAVE10', 1000n),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a code at its redemption limit', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        expiresAt: null,
        maxRedemptions: 5,
        redemptionCount: 5,
      });

      await expect(
        service.validate('event-1', 'user-1', 'SAVE10', 1000n),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a user who already redeemed this code', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
      });
      prisma.promoCodeRedemption.findUnique.mockResolvedValue({ id: 'r-1' });

      await expect(
        service.validate('event-1', 'user-1', 'SAVE10', 1000n),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('computes a PERCENT discount in basis points', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
        discountType: PromoCodeDiscountType.PERCENT,
        discountValue: 2_500, // 25%
      });
      prisma.promoCodeRedemption.findUnique.mockResolvedValue(null);

      const result = await service.validate(
        'event-1',
        'user-1',
        'save10',
        1000n,
      );

      expect(result.discountAmount).toBe(250n);
      expect(result.discountedPrice).toBe(750n);
    });

    it('computes a FIXED discount and floors at zero', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
        discountType: PromoCodeDiscountType.FIXED,
        discountValue: 5_000,
      });
      prisma.promoCodeRedemption.findUnique.mockResolvedValue(null);

      const result = await service.validate(
        'event-1',
        'user-1',
        'BIGSAVE',
        1000n,
      );

      expect(result.discountAmount).toBe(5000n);
      expect(result.discountedPrice).toBe(0n);
    });
  });

  describe('redeem', () => {
    it('increments with a conditional update and records a redemption', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        maxRedemptions: 10,
        redemptionCount: 3,
      });
      prisma.promoCodeRedemption.create.mockResolvedValue({ id: 'r-1' });

      await service.redeem('event-1', 'user-1', 'save10', 'ticket-1');

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'pc-1', isActive: true, redemptionCount: { lt: 10 } },
        data: { redemptionCount: { increment: 1 } },
      });
      expect(prisma.promoCodeRedemption.create).toHaveBeenCalledWith({
        data: { promoCodeId: 'pc-1', userId: 'user-1', ticketId: 'ticket-1' },
      });
    });

    it('has no count condition for an unlimited code', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        maxRedemptions: null,
        redemptionCount: 99,
      });
      await service.redeem('event-1', 'user-1', 'save10', 'ticket-1');
      expect(prisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'pc-1', isActive: true },
        data: { redemptionCount: { increment: 1 } },
      });
    });

    it('rejects when the conditional update matches nothing (limit reached)', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        maxRedemptions: 3,
        redemptionCount: 3,
      });
      prisma.promoCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.redeem('event-1', 'user-1', 'save10', 'ticket-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.promoCodeRedemption.create).not.toHaveBeenCalled();
    });

    it('rejects an expired code at redemption time', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        maxRedemptions: null,
        redemptionCount: 0,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.redeem('event-1', 'user-1', 'save10', 'ticket-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.promoCode.updateMany).not.toHaveBeenCalled();
    });

    it('runs inside the caller transaction when one is passed (#506)', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        promoCode: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pc-1',
            isActive: true,
            maxRedemptions: null,
            redemptionCount: 0,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        promoCodeRedemption: {
          create: jest.fn().mockResolvedValue({ id: 'r-1' }),
        },
      };
      await service.redeem(
        'event-1',
        'user-1',
        'save10',
        'ticket-1',
        tx as never,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.promoCodeRedemption.create).toHaveBeenCalled();
    });

    it('holds the limit under concurrency (#507)', async () => {
      // A store whose conditional update is atomic, as the database's is: the
      // check and the increment happen in one step, after the reads have
      // interleaved.
      const row = {
        id: 'pc-1',
        isActive: true,
        maxRedemptions: 3,
        redemptionCount: 0,
      };
      const redemptions: string[] = [];
      const tick = () => new Promise((resolve) => setImmediate(resolve));
      prisma.promoCode.findUnique.mockImplementation(async () => {
        await tick();
        return { ...row };
      });
      prisma.promoCode.updateMany.mockImplementation(
        async ({ where }: { where: { redemptionCount?: { lt: number } } }) => {
          await tick();
          if (
            where.redemptionCount &&
            !(row.redemptionCount < where.redemptionCount.lt)
          ) {
            return { count: 0 };
          }
          row.redemptionCount += 1;
          return { count: 1 };
        },
      );
      prisma.promoCodeRedemption.create.mockImplementation(
        ({ data }: { data: { userId: string } }) => {
          redemptions.push(data.userId);
          return { id: data.userId };
        },
      );

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          service.redeem('event-1', `user-${i}`, 'save10', `ticket-${i}`),
        ),
      );
      // Paste inside describe('validate') in promo-codes.service.spec.ts,
// next to 'computes a FIXED discount and floors at zero'.

    it('FIXED discount equal to the price makes the ticket free', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
        discountType: PromoCodeDiscountType.FIXED,
        discountValue: 1_000,
      });
      prisma.promoCodeRedemption.findUnique.mockResolvedValue(null);

      const result = await service.validate('event-1', 'user-1', 'FREE', 1000n);

      expect(result.discountAmount).toBe(1000n);
      expect(result.discountedPrice).toBe(0n);
    });

    it('FIXED discount below the price subtracts exactly', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        id: 'pc-1',
        isActive: true,
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
        discountType: PromoCodeDiscountType.FIXED,
        discountValue: 400,
      });
      prisma.promoCodeRedemption.findUnique.mockResolvedValue(null);

      const result = await service.validate('event-1', 'user-1', 'SAVE4', 1000n);

      expect(result.discountAmount).toBe(400n);
      expect(result.discountedPrice).toBe(600n);
    });

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      expect(row.redemptionCount).toBe(3);
      expect(redemptions).toHaveLength(3);
      for (const r of results.filter((r) => r.status === 'rejected')) {
        expect(r.reason).toBeInstanceOf(BadRequestException);
      }
    });
  });
});
