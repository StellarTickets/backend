import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return {
    ...actual,
    compare: jest.fn((data: string | Buffer, encrypted: string) =>
      actual.compare(data, encrypted),
    ),
  };
});

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

    it('normalizes email to trimmed lowercase on register (#387)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'user-1', role: 'ATTENDEE', ...data }),
      );

      const result = await service.register({
        email: '  Ada.Lovelace@EXAMPLE.COM  ',
        password: 'correct-horse-battery',
        name: 'Ada Lovelace',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'ada.lovelace@example.com' },
      });
      const createCall = prisma.user.create.mock.calls[0] as [
        { data: { email: string } },
      ];
      expect(createCall[0].data.email).toBe('ada.lovelace@example.com');
      expect(result.user.email).toBe('ada.lovelace@example.com');
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
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever12' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('gives an unknown email and a wrong password the exact same message', async () => {
      const passwordHash = await bcrypt.hash('correct-horse-battery', 4);

      prisma.user.findUnique.mockResolvedValueOnce(null);
      const unknownEmail = await service
        .login({ email: 'nobody@example.com', password: 'whatever12' })
        .catch((e: UnauthorizedException) => e.message);

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'attendee@example.com',
        passwordHash,
      });
      const wrongPassword = await service
        .login({ email: 'attendee@example.com', password: 'wrong-password' })
        .catch((e: UnauthorizedException) => e.message);

      expect(unknownEmail).toBe(wrongPassword);
    });

    it('calls bcrypt.compare even when user is not found to prevent timing attacks (#385)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as unknown as jest.Mock).mockClear();

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        expect.any(String),
      );
    });

    it('normalizes email on login so registering with mixed case and logging in with lowercase succeeds (#387)', async () => {
      const passwordHash = await bcrypt.hash('correct-horse-battery', 4);
      prisma.user.findUnique.mockImplementation(
        ({ where }: { where: { email: string } }) => {
          if (where.email === 'ana@example.com') {
            return Promise.resolve({
              id: 'user-1',
              email: 'ana@example.com',
              name: 'Ana',
              role: 'ATTENDEE',
              passwordHash,
            });
          }
          return Promise.resolve(null);
        },
      );

      const result = await service.login({
        email: '  Ana@EXAMPLE.COM  ',
        password: 'correct-horse-battery',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('ana@example.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'ana@example.com' },
      });
    });
  });
});
