import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string, tx?: Tx): Promise<User | null> {
    return (tx ?? this.prisma).user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithLocations(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        locationUsers: {
          include: { location: { include: { organization: true } } },
        },
      },
    });
  }

  async create(data: Prisma.UserCreateInput, tx?: Tx): Promise<User> {
    return (tx ?? this.prisma).user.create({ data });
  }
}
