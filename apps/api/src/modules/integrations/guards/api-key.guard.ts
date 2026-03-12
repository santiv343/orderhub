import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiKeyRepository } from '../../api-keys/repositories/api-key.repository';
import { InvalidApiKeyError } from '../../../errors/integration.errors';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyRepo: ApiKeyRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; locationId?: string }>();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey) throw new InvalidApiKeyError();

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyRepo.findActiveByHash(keyHash);

    if (!apiKey) throw new InvalidApiKeyError();

    request.locationId = apiKey.locationId;
    await this.apiKeyRepo.updateLastUsed(apiKey.id);

    return true;
  }
}
