import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyRepository } from './repositories/api-key.repository';
import { UserRepository } from '../auth/repositories/user.repository';

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyRepository, UserRepository],
  exports: [ApiKeyRepository],
})
export class ApiKeysModule {}
