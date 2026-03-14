import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendOrders } from './api';
import { OrderSource, OrderStatus } from '@orderhub/types';
import type { ImportedOrder } from '@orderhub/types';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const makeOrder = (externalId: string): ImportedOrder => ({
  externalId,
  source: OrderSource.PEDIDOSYA,
  status: OrderStatus.PENDING,
  customerName: 'Juan Pérez',
  items: [
    {
      externalId: 'item-1',
      name: 'Hamburguesa',
      quantity: 1,
      unitPrice: 500,
      totalPrice: 500,
    },
  ],
  subtotal: 500,
  discounts: 0,
  deliveryFee: 100,
  total: 600,
  placedAt: new Date('2026-03-12T15:00:00Z'),
  rawPayload: {},
});

describe('api.sendOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to /integrations/orders/import with X-Api-Key header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ imported: 1, duplicates: 0 }),
    });

    await sendOrders(
      [makeOrder('PY-001')],
      'ohk_testkey',
      'http://localhost:3000/api/v1',
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/integrations/orders/import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Api-Key': 'ohk_testkey',
        }),
      }),
    );
  });

  it('should serialize placedAt as ISO string', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ imported: 1, duplicates: 0 }),
    });

    await sendOrders(
      [makeOrder('PY-001')],
      'ohk_testkey',
      'http://localhost:3000/api/v1',
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(typeof body.orders[0].placedAt).toBe('string');
    expect(body.orders[0].placedAt).toBe('2026-03-12T15:00:00.000Z');
  });

  it('should throw when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'API_KEY_INVALID', message: 'Invalid key' } }),
    });

    await expect(
      sendOrders([makeOrder('PY-001')], 'ohk_bad', 'http://localhost:3000/api/v1'),
    ).rejects.toThrow('API_KEY_INVALID');
  });
});
