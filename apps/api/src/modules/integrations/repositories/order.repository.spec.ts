import { Test } from '@nestjs/testing';
import { OrderRepository } from './order.repository';
import { PrismaService } from '../../../shared/prisma/prisma.service';

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe('OrderRepository', () => {
  let repo: OrderRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(OrderRepository);
    jest.clearAllMocks();
  });

  describe('findByExternalId', () => {
    it('should query by locationId + source + externalId', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await repo.findByExternalId('loc1', 'PEDIDOSYA', 'ext123');

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: {
          locationId_source_externalId: {
            locationId: 'loc1',
            source: 'PEDIDOSYA',
            externalId: 'ext123',
          },
        },
      });
    });
  });
});
