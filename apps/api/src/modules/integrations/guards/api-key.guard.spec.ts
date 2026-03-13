import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyRepository } from '../../api-keys/repositories/api-key.repository';
import { InvalidApiKeyError } from '../../../errors/integration.errors';

const mockApiKeyRepo = { findActiveByHash: jest.fn(), updateLastUsed: jest.fn() };

function makeContext(headers: Record<string, string>) {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: ApiKeyRepository, useValue: mockApiKeyRepo },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);
    jest.clearAllMocks();
  });

  it('should throw InvalidApiKeyError when header is missing', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(
      InvalidApiKeyError,
    );
  });

  it('should throw InvalidApiKeyError when hash not found', async () => {
    mockApiKeyRepo.findActiveByHash.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ 'x-api-key': 'ohk_invalid' })),
    ).rejects.toThrow(InvalidApiKeyError);
  });

  it('should return true and inject locationId when key is valid', async () => {
    mockApiKeyRepo.findActiveByHash.mockResolvedValue({
      id: 'key1',
      locationId: 'loc1',
      revokedAt: null,
    });
    const ctx = makeContext({ 'x-api-key': 'ohk_validkey' });
    const request = ctx.switchToHttp().getRequest() as Record<string, unknown>;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request['locationId']).toBe('loc1');
  });
});
