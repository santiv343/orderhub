import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueOrder,
  processQueue,
  getNextDelay,
  isReadyToRetry,
  type QueueProcessor,
} from './background';
import { RETRY } from './constants';
import type { QueueItem } from './extension.types';
import { OrderSource, OrderStatus } from '@orderhub/types';
import type { ImportedOrder } from '@orderhub/types';

const makeOrder = (): ImportedOrder => ({
  externalId: 'PY-001',
  source: OrderSource.PEDIDOSYA,
  status: OrderStatus.PENDING,
  customerName: 'Juan',
  items: [],
  subtotal: 100,
  discounts: 0,
  deliveryFee: 0,
  total: 100,
  placedAt: new Date(),
  rawPayload: {},
});

describe('background queue', () => {
  describe('getNextDelay', () => {
    it('should return delay for given attempt', () => {
      expect(getNextDelay(0)).toBe(RETRY.DELAYS[0]); // 1000
      expect(getNextDelay(2)).toBe(RETRY.DELAYS[2]); // 4000
    });

    it('should return last delay when attempts exceed array length', () => {
      expect(getNextDelay(99)).toBe(RETRY.DELAYS[RETRY.DELAYS.length - 1]); // 60000
    });
  });

  describe('processQueue', () => {
    let queue: QueueItem[];
    let mockSend: ReturnType<typeof vi.fn>;
    let mockSave: ReturnType<typeof vi.fn>;
    let processor: QueueProcessor;

    beforeEach(() => {
      queue = [];
      mockSend = vi.fn();
      mockSave = vi.fn().mockResolvedValue(undefined);
      processor = { send: mockSend, saveQueue: mockSave };
    });

    it('should send pending item and remove it from queue on success', async () => {
      const item: QueueItem = {
        id: 'q1',
        order: makeOrder(),
        attempts: 0,
        lastAttemptAt: null,
        failedAt: null,
      };
      queue.push(item);
      mockSend.mockResolvedValue({ imported: 1, duplicates: 0 });

      await processQueue(queue, 'ohk_key', 'http://localhost:3000/api/v1', processor);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const savedQueue = mockSave.mock.calls[0][0] as QueueItem[];
      expect(savedQueue).toHaveLength(0);
    });

    it('should increment attempts and keep item in queue on failure', async () => {
      const item: QueueItem = {
        id: 'q1',
        order: makeOrder(),
        attempts: 0,
        lastAttemptAt: null,
        failedAt: null,
      };
      queue.push(item);
      mockSend.mockRejectedValue(new Error('Network error'));

      await processQueue(queue, 'ohk_key', 'http://localhost:3000/api/v1', processor);

      const savedQueue = mockSave.mock.calls[0][0] as QueueItem[];
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].attempts).toBe(1);
    });

    it('should mark item as failed after MAX_ATTEMPTS', async () => {
      const item: QueueItem = {
        id: 'q1',
        order: makeOrder(),
        attempts: RETRY.MAX_ATTEMPTS - 1,
        lastAttemptAt: Date.now() - 70000,
        failedAt: null,
      };
      queue.push(item);
      mockSend.mockRejectedValue(new Error('Network error'));

      await processQueue(queue, 'ohk_key', 'http://localhost:3000/api/v1', processor);

      const savedQueue = mockSave.mock.calls[0][0] as QueueItem[];
      expect(savedQueue[0].failedAt).not.toBeNull();
    });

    it('should skip items that failed definitively', async () => {
      const item: QueueItem = {
        id: 'q1',
        order: makeOrder(),
        attempts: RETRY.MAX_ATTEMPTS,
        lastAttemptAt: Date.now(),
        failedAt: Date.now(),
      };
      queue.push(item);

      await processQueue(queue, 'ohk_key', 'http://localhost:3000/api/v1', processor);

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('isReadyToRetry', () => {
    it('should return false for items with failedAt set', () => {
      const item: QueueItem = {
        id: '1', order: makeOrder(), attempts: 10,
        lastAttemptAt: Date.now() - 999999,
        failedAt: Date.now(),
      };
      expect(isReadyToRetry(item)).toBe(false);
    });

    it('should return true for new items with no previous attempt', () => {
      const item: QueueItem = {
        id: '1', order: makeOrder(), attempts: 0,
        lastAttemptAt: null, failedAt: null,
      };
      expect(isReadyToRetry(item)).toBe(true);
    });

    it('should return false when not enough time has passed since last attempt', () => {
      const item: QueueItem = {
        id: '1', order: makeOrder(), attempts: 0,
        lastAttemptAt: Date.now() - 500, // solo 500ms, necesita 1000ms
        failedAt: null,
      };
      expect(isReadyToRetry(item)).toBe(false);
    });

    it('should return true when enough time has passed since last attempt', () => {
      const item: QueueItem = {
        id: '1', order: makeOrder(), attempts: 0,
        lastAttemptAt: Date.now() - 1500, // 1500ms pasaron, necesita 1000ms
        failedAt: null,
      };
      expect(isReadyToRetry(item)).toBe(true);
    });
  });
});
