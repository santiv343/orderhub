import { Test } from '@nestjs/testing';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyRepository } from './repositories/api-key.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { ApiKeyNotFoundError } from '../../errors/integration.errors';

const mockApiKeyRepo = {
  create: jest.fn(),
  findAllByLocation: jest.fn(),
  revoke: jest.fn(),
};

const mockUserRepo = {
  findByIdWithLocations: jest.fn(),
};

const mockUserWithLocation = {
  id: 'user1',
  locationUsers: [{ location: { id: 'loc1', organizationId: 'org1' } }],
};

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: ApiKeyRepository, useValue: mockApiKeyRepo },
        { provide: UserRepository, useValue: mockUserRepo },
      ],
    }).compile();
    service = module.get(ApiKeysService);
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should return a key starting with ohk_', async () => {
      mockUserRepo.findByIdWithLocations.mockResolvedValue(mockUserWithLocation);
      mockApiKeyRepo.create.mockResolvedValue({
        id: 'key1', name: 'Test', keyHash: 'hash', locationId: 'loc1',
        revokedAt: null, lastUsedAt: null, expiresAt: null, createdAt: new Date(),
      });

      const result = await service.generate('user1', { name: 'Test' });

      expect(result.key).toMatch(/^ohk_/);
    });

    it('should NOT store the raw key — only the hash', async () => {
      mockUserRepo.findByIdWithLocations.mockResolvedValue(mockUserWithLocation);
      mockApiKeyRepo.create.mockResolvedValue({
        id: 'key1', name: 'Test', keyHash: 'hash', locationId: 'loc1',
        revokedAt: null, lastUsedAt: null, expiresAt: null, createdAt: new Date(),
      });

      const result = await service.generate('user1', { name: 'Test' });

      const storedHash = mockApiKeyRepo.create.mock.calls[0][0].keyHash;
      expect(storedHash).not.toEqual(result.key);
      expect(storedHash).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('revoke', () => {
    it('should throw ApiKeyNotFoundError if key does not exist', async () => {
      mockApiKeyRepo.revoke.mockResolvedValue(null);

      await expect(service.revoke('user1', 'nonexistent')).rejects.toThrow(
        ApiKeyNotFoundError,
      );
    });
  });
});
