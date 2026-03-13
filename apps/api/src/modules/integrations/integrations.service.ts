import { Injectable } from '@nestjs/common';
import { OrderRepository } from './repositories/order.repository';
import type { ImportOrdersDto } from './dto/import-orders.dto';
import type { ImportResult } from './integrations.types';

@Injectable()
export class IntegrationsService {
  constructor(private readonly orderRepo: OrderRepository) {}

  async importOrders(
    locationId: string,
    dto: ImportOrdersDto,
  ): Promise<ImportResult> {
    let imported = 0;
    let duplicates = 0;

    for (const order of dto.orders) {
      const existing = await this.orderRepo.findByExternalId(
        locationId,
        order.source,
        order.externalId,
      );

      if (existing) {
        duplicates++;
        continue;
      }

      await this.orderRepo.create(locationId, order);
      imported++;
    }

    return { imported, duplicates };
  }
}
