import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        stellarPublicKey: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async connectWallet(userId: string, stellarPublicKey: string) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { stellarPublicKey },
        select: { id: true, stellarPublicKey: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'That wallet is already connected to another account',
        );
      }
      throw err;
    }
  }

  /** Used by organizers/attendees to resolve a recipient before issuing or transferring a ticket. */
  async lookupByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, stellarPublicKey: true },
    });
    if (!user) {
      throw new NotFoundException('No account found with that email');
    }
    return user;
  }
}
