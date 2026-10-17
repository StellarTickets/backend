import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { JWT_SIGNING_SECRET } from '../jwt-secret.module';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(JWT_SIGNING_SECRET) secret: string,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * #388/#389 — the token only proves who the caller was at sign-in. The
   * account is re-read on every request (one primary-key lookup) so a
   * deleted user is rejected and a changed role takes effect immediately,
   * instead of the token's claims being trusted until expiry.
   */
  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, email: user.email, role: user.role };
  }
}
