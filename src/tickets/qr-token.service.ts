import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT_SIGNING_SECRET } from '../auth/jwt-secret.module';

const TOKEN_VERSION = 'v1';
const DEFAULT_TTL_SECONDS = 30;
const DEFAULT_CLOCK_SKEW_SECONDS = 5;

export interface IssuedQrToken {
  token: string;
  /** ISO timestamp after which the token is rejected (plus the clock-skew tolerance). */
  expiresAt: string;
  ttlSeconds: number;
}

/**
 * Short-lived, signed stand-in for a ticket's static `qrSecret` (#129).
 *
 * A screenshot of a static QR code can be shared and replayed before entry.
 * A rotating token is `v1.<ticketId>.<exp>.<signature>`: the owner fetches a
 * fresh one every few seconds and renders that instead, and
 * `GET /tickets/verify/:value` accepts it until `exp` (plus a configurable
 * clock-skew tolerance). A static `qrSecret` is a bare UUID with no dots, so
 * the two never collide.
 *
 * Signed with HMAC-SHA256 under a key derived from the app's JWT secret for
 * this purpose only. The token is deliberately not a JWT, so it can never be
 * presented as a bearer credential.
 *
 * - `QR_TOKEN_TTL_SECONDS` (default 30) — how long a freshly issued token lasts.
 * - `QR_TOKEN_CLOCK_SKEW_SECONDS` (default 5) — extra grace after `exp`, for
 *   scanners whose clock runs behind this server's.
 */
@Injectable()
export class QrTokenService {
  private readonly key: Buffer;

  constructor(
    @Inject(JWT_SIGNING_SECRET) secret: string,
    private readonly config: ConfigService,
  ) {
    this.key = createHmac('sha256', secret)
      .update('stellartickets:ticket-qr-token:v1')
      .digest();
  }

  /** Whether a `/tickets/verify/:value` value is a rotating token rather than a static `qrSecret`. */
  static isToken(value: string): boolean {
    return value.startsWith(`${TOKEN_VERSION}.`);
  }

  issue(ticketId: string): IssuedQrToken {
    const ttlSeconds = this.readSeconds(
      'QR_TOKEN_TTL_SECONDS',
      DEFAULT_TTL_SECONDS,
      1,
    );
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const body = `${TOKEN_VERSION}.${ticketId}.${exp}`;
    return {
      token: `${body}.${this.sign(body)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
      ttlSeconds,
    };
  }

  /**
   * Returns the id of the ticket the token was issued for. A malformed or
   * forged token is reported as an unknown ticket, exactly like an unknown
   * static secret; a genuine but expired one says so.
   */
  verify(token: string): string {
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
      throw new NotFoundException('Ticket not found');
    }
    const [version, ticketId, expRaw, signature] = parts;

    const expected = Buffer.from(this.sign(`${version}.${ticketId}.${expRaw}`));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new NotFoundException('Ticket not found');
    }

    const skewSeconds = this.readSeconds(
      'QR_TOKEN_CLOCK_SKEW_SECONDS',
      DEFAULT_CLOCK_SKEW_SECONDS,
      0,
    );
    if (Math.floor(Date.now() / 1000) > Number(expRaw) + skewSeconds) {
      throw new BadRequestException(
        'QR code has expired. Ask the attendee to refresh it.',
      );
    }
    return ticketId;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }

  /** Reads a whole-number setting from env, falling back when it is unset or invalid. */
  private readSeconds(key: string, fallback: number, min: number): number {
    const value = Number(this.config.get<string | number>(key));
    return Number.isInteger(value) && value >= min ? value : fallback;
  }
}
