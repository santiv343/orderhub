import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { ApiKeyRepository } from './repositories/api-key.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
import { ApiKeyNotFoundError } from '../../errors/integration.errors';
import { API_KEY } from '../../constants/api-key';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async generate(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ key: string; meta: ApiKeyResponseDto }> {
    const locationId = await this.getLocationId(userId);

    const raw = randomBytes(API_KEY.BYTES).toString('hex');
    const key = `${API_KEY.PREFIX}${raw}`;
    const keyHash = createHash('sha256').update(key).digest('hex');

    const created = await this.apiKeyRepo.create({
      locationId,
      keyHash,
      name: dto.name,
    });

    return { key, meta: new ApiKeyResponseDto(created) };
  }

  async list(userId: string): Promise<ApiKeyResponseDto[]> {
    const locationId = await this.getLocationId(userId);
    const keys = await this.apiKeyRepo.findAllByLocation(locationId);
    return keys.map((k) => new ApiKeyResponseDto(k));
  }

  async revoke(userId: string, keyId: string): Promise<void> {
    const revoked = await this.apiKeyRepo.revoke(keyId);
    if (!revoked) throw new ApiKeyNotFoundError(keyId);
  }

  private async getLocationId(userId: string): Promise<string> {
    const user = await this.userRepo.findByIdWithLocations(userId);
    // MVP: users have exactly one location created at registration
    const locationUser = user!.locationUsers[0]!;
    return locationUser.location.id;
  }
}
