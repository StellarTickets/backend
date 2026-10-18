import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

/**
 * #385 — fixed dummy bcrypt hash used when an email is unknown, ensuring
 * `bcrypt.compare` executes and takes equivalent computation time regardless
 * of whether the account exists.
 */
const DUMMY_HASH =
  '$2b$12$Mm25jOsvB1cT9TlV02n5tebZEwmESUQ0Vuyz2bg9GmInAxSoKG5ae';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name: dto.name },
    });

    return this.buildAuthResult(user.id, user.email, user.name, user.role);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const passwordValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResult(user.id, user.email, user.name, user.role);
  }

  private buildAuthResult(
    id: string,
    email: string,
    name: string,
    role: string,
  ): AuthResult {
    const accessToken = this.jwt.sign({ sub: id, email, role });
    return { accessToken, user: { id, email, name, role } };
  }
}
