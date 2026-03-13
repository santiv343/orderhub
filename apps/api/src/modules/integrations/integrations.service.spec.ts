import { Test } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderSource, OrderStatus } from '@orderhub/types';
import type { ImportedOrderDto } from './dto/import-orders.dto';
import type { ImportResult } from './integrations.types';

const mockOrderRepo = {
  findByExternalId: jest.fn(),
  create: jest.fn(),
};

const makeOrder = (externalId: string): ImportedOrderDto => ({
  externalId,
  source: OrderSource.PEDIDOSYA,
  status: OrderStatus.PENDING,
  customerName: 'Juan',
  items: [],
  subtotal: 100,
  discounts: 0,
  deliveryFee: 0,
  total: 100,
  placedAt: new Date().toISOString(),
});

describe('IntegrationsService', () => {
  let service: IntegrationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: OrderRepository, useValue: mockOrderRepo },
      ],
    }).compile();
    service = module.get(IntegrationsService);
    jest.clearAllMocks();
  });

  describe('importOrders', () => {
    it('should import a new order and return imported=1, duplicates=0', async () => {
      mockOrderRepo.findByExternalId.mockResolvedValue(null);
      mockOrderRepo.create.mockResolvedValue({ id: 'order1' });

      const result: ImportResult = await service.importOrders('loc1', {
        orders: [makeOrder('ext1')],
      });

      expect(result).toEqual({ imported: 1, duplicates: 0 });
      expect(mockOrderRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should skip a duplicate and return imported=0, duplicates=1', async () => {
      mockOrderRepo.findByExternalId.mockResolvedValue({ id: 'existing' });

      const result: ImportResult = await service.importOrders('loc1', {
        orders: [makeOrder('ext1')],
      });

      expect(result).toEqual({ imported: 0, duplicates: 1 });
      expect(mockOrderRepo.create).not.toHaveBeenCalled();
    });

    it('should handle a batch with mix of new and duplicate orders', async () => {
      mockOrderRepo.findByExternalId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'x' })
        .mockResolvedValueOnce(null);

      const result: ImportResult = await service.importOrders('loc1', {
        orders: [makeOrder('ext1'), makeOrder('ext2'), makeOrder('ext3')],
      });

      expect(result).toEqual({ imported: 2, duplicates: 1 });
    });
  });
});
