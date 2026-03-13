import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { OrderRepository } from './repositories/order.repository';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, OrderRepository, ApiKeyGuard],
})
export class IntegrationsModule {}
