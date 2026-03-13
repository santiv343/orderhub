import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConfig, saveApiKey, saveBackendUrl, getQueue, saveQueue } from './storage';
import { DEFAULTS, STORAGE_KEYS } from './constants';

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return config with defaults when storage is empty', async () => {
      (chrome.storage.sync.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({}),
      );

      const config = await getConfig();

      expect(config.apiKey).toBe('');
      expect(config.backendUrl).toBe(DEFAULTS.BACKEND_URL);
    });

    it('should return stored config when present', async () => {
      (chrome.storage.sync.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_keys: unknown, cb: (result: Record<string, string>) => void) =>
          cb({
            [STORAGE_KEYS.API_KEY]: 'ohk_test123',
            [STORAGE_KEYS.BACKEND_URL]: 'http://localhost:3000/api/v1',
          }),
      );

      const config = await getConfig();

      expect(config.apiKey).toBe('ohk_test123');
      expect(config.backendUrl).toBe('http://localhost:3000/api/v1');
    });
  });

  describe('saveApiKey', () => {
    it('should save the api key to chrome.storage.sync', async () => {
      (chrome.storage.sync.set as ReturnType<typeof vi.fn>).mockImplementation(
        (_data: unknown, cb: () => void) => cb(),
      );

      await saveApiKey('ohk_newkey');

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.API_KEY]: 'ohk_newkey' },
        expect.any(Function),
      );
    });
  });

  describe('saveBackendUrl', () => {
    it('should save the backend URL to chrome.storage.sync', async () => {
      (chrome.storage.sync.set as ReturnType<typeof vi.fn>).mockImplementation(
        (_data: unknown, cb: () => void) => cb(),
      );

      await saveBackendUrl('http://localhost:3000/api/v1');

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.BACKEND_URL]: 'http://localhost:3000/api/v1' },
        expect.any(Function),
      );
    });
  });

  describe('getQueue / saveQueue', () => {
    it('should return empty array when queue is empty', async () => {
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
        (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({}),
      );

      const queue = await getQueue();
      expect(queue).toEqual([]);
    });

    it('should persist and retrieve queue items', async () => {
      const items = [{ id: '1', order: {} as never, attempts: 0, lastAttemptAt: null, failedAt: null }];

      (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
        (_data: unknown, cb: () => void) => cb(),
      );

      await saveQueue(items);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.QUEUE]: items },
        expect.any(Function),
      );
    });
  });
});
