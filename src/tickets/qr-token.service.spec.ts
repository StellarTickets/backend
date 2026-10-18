import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { QrTokenService } from './qr-token.service';

const SECRET = 'a'.repeat(48);
const TICKET_ID = '3f2b8c1e-5d4a-4c6b-9e7f-1a2b3c4d5e6f';
const NOW = new Date('2026-10-17T12:00:00.000Z');

function build(
  settings: Record<string, string | number> = {},
  secret = SECRET,
): QrTokenService {
  const config = { get: jest.fn((key: string) => settings[key]) };
  return new QrTokenService(secret, config as unknown as ConfigService);
}

/** Swaps one dot-separated part of a token, leaving the rest (and so the signature) untouched. */
function withPart(token: string, index: number, value: string): string {
  const parts = token.split('.');
  parts[index] = value;
  return parts.join('.');
}

describe('QrTokenService', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  describe('issue', () => {
    it('issues a 30-second token by default that verifies back to its ticket', () => {
      const service = build();

      const issued = service.issue(TICKET_ID);

      expect(issued.ttlSeconds).toBe(30);
      expect(issued.expiresAt).toBe('2026-10-17T12:00:30.000Z');
      expect(QrTokenService.isToken(issued.token)).toBe(true);
      expect(service.verify(issued.token)).toBe(TICKET_ID);
    });

    it('honours QR_TOKEN_TTL_SECONDS, including the string form env vars arrive in', () => {
      const issued = build({ QR_TOKEN_TTL_SECONDS: '60' }).issue(TICKET_ID);

      expect(issued.ttlSeconds).toBe(60);
      expect(issued.expiresAt).toBe('2026-10-17T12:01:00.000Z');
    });

    it.each(['0', '-5', 'abc', '1.5'])(
      'falls back to the default TTL for an invalid QR_TOKEN_TTL_SECONDS of %s',
      (value) => {
        const issued = build({ QR_TOKEN_TTL_SECONDS: value }).issue(TICKET_ID);

        expect(issued.ttlSeconds).toBe(30);
      },
    );

    it('is not mistaken for a static qrSecret', () => {
      expect(
        QrTokenService.isToken('c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f'),
      ).toBe(false);
    });
  });

  describe('verify — expiry', () => {
    it('accepts a token until its expiry plus the default 5s clock skew', () => {
      const service = build();
      const { token } = service.issue(TICKET_ID);

      jest.setSystemTime(new Date(NOW.getTime() + 35_000));

      expect(service.verify(token)).toBe(TICKET_ID);
    });

    it('rejects a token once it is past its expiry and the clock skew', () => {
      const service = build();
      const { token } = service.issue(TICKET_ID);

      jest.setSystemTime(new Date(NOW.getTime() + 36_000));

      expect(() => service.verify(token)).toThrow(BadRequestException);
    });

    it('applies a configured clock-skew tolerance', () => {
      const strict = build({ QR_TOKEN_CLOCK_SKEW_SECONDS: 0 });
      const lenient = build({ QR_TOKEN_CLOCK_SKEW_SECONDS: '60' });
      const { token } = strict.issue(TICKET_ID);

      jest.setSystemTime(new Date(NOW.getTime() + 31_000));
      expect(() => strict.verify(token)).toThrow(BadRequestException);
      expect(lenient.verify(token)).toBe(TICKET_ID);

      jest.setSystemTime(new Date(NOW.getTime() + 91_000));
      expect(() => lenient.verify(token)).toThrow(BadRequestException);
    });
  });

  describe('verify — forgery', () => {
    const service = build();

    it.each([
      ['a different ticket id', 1, '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'],
      ['a later expiry', 2, '9999999999'],
      ['a different signature', 3, 'A'.repeat(43)],
    ] as const)('rejects a token with %s', (_label, index, value) => {
      const { token } = service.issue(TICKET_ID);

      expect(() => service.verify(withPart(token, index, value))).toThrow(
        NotFoundException,
      );
    });

    it('rejects a token signed under a different secret', () => {
      const { token } = build({}, 'b'.repeat(48)).issue(TICKET_ID);

      expect(() => service.verify(token)).toThrow(NotFoundException);
    });

    it.each(['v1.', 'v1.a.b', 'v2.a.1.sig', 'v1.a.b.c.d', 'plain-secret'])(
      'rejects the malformed token %s',
      (token) => {
        expect(() => service.verify(token)).toThrow(NotFoundException);
      },
    );
  });
});
