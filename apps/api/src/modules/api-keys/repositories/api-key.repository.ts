import { Injectable } from '@nestjs/common';
import type { LocationApiKey } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByHash(keyHash: string): Promise<LocationApiKey | null> {
    return this.prisma.locationApiKey.findUnique({
      where: { keyHash, revokedAt: null },
    });
  }

  async findAllByLocation(locationId: string): Promise<LocationApiKey[]> {
    return this.prisma.locationApiKey.findMany({
      where: { locationId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    locationId: string;
    keyHash: string;
    name: string;
  }): Promise<LocationApiKey> {
    return this.prisma.locationApiKey.create({ data });
  }

  async revoke(id: string, locationId: string): Promise<boolean> {
    const result = await this.prisma.locationApiKey.updateMany({
      where: { id, locationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.prisma.locationApiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}
