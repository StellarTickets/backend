import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { sign: jest.Mock };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('hashes the password and issues a token for a new email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'user-1', role: 'ATTENDEE', ...data }),
      );

      const result = await service.register({
        email: 'attendee@example.com',
        password: 'correct-horse-battery',
        name: 'Ada Lovelace',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.user.create.mock.calls[0] as [
        { data: { passwordHash: string } },
      ];
      const storedHash = createCall[0].data.passwordHash;
      expect(storedHash).not.toBe('correct-horse-battery');
      expect(await bcrypt.compare('correct-horse-battery', storedHash)).toBe(
        true,
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('attendee@example.com');
    });

    it('rejects a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'dup@example.com',
          password: 'x'.repeat(12),
          name: 'Dup',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('issues a token when the password matches', async () => {
      const passwordHash = await bcrypt.hash('correct-horse-battery', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'attendee@example.com',
        name: 'Ada Lovelace',
        role: 'ATTENDEE',
        passwordHash,
      });

      const result = await service.login({
        email: 'attendee@example.com',
        password: 'correct-horse-battery',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects a wrong password without leaking which field was wrong', async () => {
      const passwordHash = await bcrypt.hash('correct-horse-battery', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'attendee@example.com',
        passwordHash,
      });

      await expect(
        service.login({
          email: 'attendee@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever12' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
