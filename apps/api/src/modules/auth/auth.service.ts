import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AppConfig } from '../../config/config';
import { UserRole } from '@orderhub/types';
import type { Prisma } from '@prisma/client';
import {
  InvalidCredentialsError,
  TokenInvalidError,
  UserAlreadyExistsError,
} from '../../errors/auth.errors';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { AuthUser, JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AuthService {
  private readonly config: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.get<AppConfig>('app')!;
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new UserAlreadyExistsError(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const baseSlug = slugify(dto.businessName);

    const { user, location } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      const slug = await this.uniqueSlug(baseSlug, tx);

      const org = await tx.organization.create({
        data: {
          name: dto.businessName,
          slug,
        },
      });

      const location = await tx.location.create({
        data: {
          name: dto.businessName,
          organizationId: org.id,
        },
      });

      await tx.organizationUser.create({
        data: { organizationId: org.id, userId: user.id, role: UserRole.ORG_ADMIN },
      });

      await tx.locationUser.create({
        data: { locationId: location.id, userId: user.id, role: UserRole.LOCATION_MANAGER },
      });

      return { user, location };
    });

    const tokens = await this.generateTokens(user.id, user.email, location.id);
    return { user: this.sanitizeUser(user), tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new InvalidCredentialsError();

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    const locationUser = await this.prisma.locationUser.findFirst({
      where: { userId: user.id },
    });
    if (!locationUser) throw new InvalidCredentialsError();

    const tokens = await this.generateTokens(user.id, user.email, locationUser.locationId);
    return { user: this.sanitizeUser(user), tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string; type: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new TokenInvalidError();
    }

    if (payload.type !== 'refresh') throw new TokenInvalidError();

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: payload.jti },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new TokenInvalidError();
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const locationUser = await this.prisma.locationUser.findFirst({
      where: { userId: stored.userId },
    });
    if (!locationUser) throw new TokenInvalidError();

    const tokens = await this.generateTokens(stored.userId, stored.user.email, locationUser.locationId);
    return { tokens };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    let payload: { jti: string } | null = null;
    try {
      payload = this.jwtService.verify(refreshToken, { secret: this.config.JWT_REFRESH_SECRET }) as { jti: string };
    } catch {
      return;
    }
    if (!payload) return;
    await this.prisma.refreshToken
      .update({ where: { token: payload.jti }, data: { revokedAt: new Date() } })
      .catch(() => null);
  }

  async me(authUser: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.userId },
      include: {
        locationUsers: { include: { location: { include: { organization: true } } } },
      },
    });
    return this.sanitizeUser(user!);
  }

  private async generateTokens(userId: string, email: string, locationId: string) {
    const jti = randomUUID();

    const accessPayload: JwtPayload = { sub: userId, email, locationId, type: 'access' };
    const accessToken = this.jwtService.sign(accessPayload as any, {
      secret: this.config.JWT_SECRET,
      expiresIn: this.config.JWT_EXPIRES_IN as any,
    });

    const refreshToken = this.jwtService.sign(
      { sub: userId, jti: jti as string, type: 'refresh' } as any,
      { secret: this.config.JWT_REFRESH_SECRET, expiresIn: this.config.JWT_REFRESH_EXPIRES_IN as any },
    );

    await this.prisma.refreshToken.create({
      data: {
        token: jti,
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  private async uniqueSlug(base: string, tx: Prisma.TransactionClient): Promise<string> {
    const existing = await tx.organization.findUnique({ where: { slug: base } });
    if (!existing) return base;
    const suffix = randomUUID().slice(0, 6);
    return `${base}-${suffix}`;
  }

  private sanitizeUser(user: { id: string; email: string; firstName: string; lastName: string; isEmailVerified: boolean; isActive: boolean; createdAt: Date }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
