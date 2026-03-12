import type { LocationApiKey } from '@prisma/client';

export class ApiKeyResponseDto {
  id: string;
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date;

  constructor(key: LocationApiKey) {
    this.id = key.id;
    this.name = key.name;
    this.lastUsedAt = key.lastUsedAt;
    this.createdAt = key.createdAt;
  }
}
