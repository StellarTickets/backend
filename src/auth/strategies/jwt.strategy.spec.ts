import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  const payload = {
    sub: 'user-1',
    email: 'ada@example.com',
    role: 'ATTENDEE',
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(
      'x'.repeat(32),
      prisma as unknown as PrismaService,
    );
  });

  it('maps the stored user to the shape guards and controllers expect', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      role: 'ATTENDEE',
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      userId: 'user-1',
      email: 'ada@example.com',
      role: 'ATTENDEE',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, role: true },
    });
  });

  it('uses the role stored in the database, not the one in the token (#388)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      role: 'ORGANIZER',
    });

    const result = await strategy.validate(payload);

    expect(result.role).toBe('ORGANIZER');
  });

  it('rejects the token of a user that no longer exists (#389)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
