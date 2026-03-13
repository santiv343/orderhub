import { Test } from '@nestjs/testing';
import { ApiKeyRepository } from './api-key.repository';
import { PrismaService } from '../../../shared/prisma/prisma.service';

const mockPrisma = {
  locationApiKey: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('ApiKeyRepository', () => {
  let repo: ApiKeyRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(ApiKeyRepository);
    jest.clearAllMocks();
  });

  describe('findActiveByHash', () => {
    it('should return key when found and not revoked', async () => {
      const mockKey = { id: '1', keyHash: 'abc', revokedAt: null, locationId: 'loc1' };
      mockPrisma.locationApiKey.findUnique.mockResolvedValue(mockKey);

      const result = await repo.findActiveByHash('abc');

      expect(mockPrisma.locationApiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: 'abc', revokedAt: null },
      });
      expect(result).toEqual(mockKey);
    });

    it('should return null when key is revoked or not found', async () => {
      mockPrisma.locationApiKey.findUnique.mockResolvedValue(null);
      const result = await repo.findActiveByHash('invalid');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a key with the given hash and name', async () => {
      const data = { locationId: 'loc1', keyHash: 'hash123', name: 'Extension key' };
      const mockKey = { id: '1', ...data, revokedAt: null, createdAt: new Date() };
      mockPrisma.locationApiKey.create.mockResolvedValue(mockKey);

      const result = await repo.create(data);

      expect(mockPrisma.locationApiKey.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(mockKey);
    });
  });
});
