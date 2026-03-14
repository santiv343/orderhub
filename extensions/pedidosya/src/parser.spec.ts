import { OrderSource, OrderStatus } from '@orderhub/types';
import type { PedidosYaOrderDetail } from './extension.types';
import { parseOrder, isOrderEndpoint, tryExtractOrder } from './parser';

const FIXTURE: PedidosYaOrderDetail = {
  id: 98765,
  code: 'PY-98765',
  state: 'CONFIRMED',
  registeredDate: '2026-03-13T14:30:00.000Z',
  notes: 'Sin cebolla por favor',
  user: {
    name: 'María',
    lastName: 'González',
    phoneNumber: '+54 11 1234-5678',
  },
  address: {
    description: 'Av. Corrientes 1234, CABA',
  },
  orderDetails: [
    {
      id: 1,
      product: {
        id: 101,
        name: 'Hamburguesa Clásica',
        integrationCode: 'BURG-001',
      },
      unitaryPrice: 1500,
      amount: 2,
      subTotal: 3000,
      notes: 'Sin mayonesa',
    },
    {
      id: 2,
      product: {
        id: 102,
        name: 'Papas Fritas',
        integrationCode: 'PAPA-001',
      },
      unitaryPrice: 800,
      amount: 1,
      subTotal: 800,
    },
  ],
  total: 3500,
  subtotal: 3800,
  discountAmount: 300,
  shippingAmount: 0,
};

describe('parseOrder', () => {
  it('maps externalId from raw.id as string', () => {
    const result = parseOrder(FIXTURE);
    expect(result.externalId).toBe('98765');
  });

  it('sets source to PEDIDOSYA', () => {
    const result = parseOrder(FIXTURE);
    expect(result.source).toBe(OrderSource.PEDIDOSYA);
  });

  it('sets status to PENDING', () => {
    const result = parseOrder(FIXTURE);
    expect(result.status).toBe(OrderStatus.PENDING);
  });

  it('builds customerName from name + lastName', () => {
    const result = parseOrder(FIXTURE);
    expect(result.customerName).toBe('María González');
  });

  it('maps customerPhone from user.phoneNumber', () => {
    const result = parseOrder(FIXTURE);
    expect(result.customerPhone).toBe('+54 11 1234-5678');
  });

  it('maps customerAddress from address.description', () => {
    const result = parseOrder(FIXTURE);
    expect(result.customerAddress).toBe('Av. Corrientes 1234, CABA');
  });

  it('maps items correctly', () => {
    const result = parseOrder(FIXTURE);
    expect(result.items).toHaveLength(2);

    const first = result.items[0];
    expect(first.externalId).toBe('1');
    expect(first.name).toBe('Hamburguesa Clásica');
    expect(first.quantity).toBe(2);
    expect(first.unitPrice).toBe(1500);
    expect(first.totalPrice).toBe(3000);
    expect(first.notes).toBe('Sin mayonesa');

    const second = result.items[1];
    expect(second.externalId).toBe('2');
    expect(second.name).toBe('Papas Fritas');
    expect(second.notes).toBeUndefined();
  });

  it('maps subtotal from raw.subtotal', () => {
    const result = parseOrder(FIXTURE);
    expect(result.subtotal).toBe(3800);
  });

  it('maps discounts from raw.discountAmount', () => {
    const result = parseOrder(FIXTURE);
    expect(result.discounts).toBe(300);
  });

  it('maps deliveryFee from raw.shippingAmount', () => {
    const result = parseOrder(FIXTURE);
    expect(result.deliveryFee).toBe(0);
  });

  it('maps total from raw.total', () => {
    const result = parseOrder(FIXTURE);
    expect(result.total).toBe(3500);
  });

  it('maps notes from raw.notes', () => {
    const result = parseOrder(FIXTURE);
    expect(result.notes).toBe('Sin cebolla por favor');
  });

  it('parses placedAt as a Date from registeredDate', () => {
    const result = parseOrder(FIXTURE);
    expect(result.placedAt).toBeInstanceOf(Date);
    expect(result.placedAt.toISOString()).toBe('2026-03-13T14:30:00.000Z');
  });

  it('stores rawPayload as the original object', () => {
    const result = parseOrder(FIXTURE);
    expect(result.rawPayload).toEqual(FIXTURE);
  });

  it('handles minimal order — no user, no address, no notes', () => {
    const minimal: PedidosYaOrderDetail = {
      id: 1,
      code: 'PY-1',
      state: 'PENDING',
      registeredDate: '2026-03-13T10:00:00.000Z',
      orderDetails: [],
      total: 500,
    };

    const result = parseOrder(minimal);
    expect(result.customerName).toBe('Cliente PedidosYa');
    expect(result.customerPhone).toBeUndefined();
    expect(result.customerAddress).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.items).toHaveLength(0);
    expect(result.subtotal).toBe(500);
    expect(result.discounts).toBe(0);
    expect(result.deliveryFee).toBe(0);
  });

  it('handles user with only name (no lastName)', () => {
    const raw: PedidosYaOrderDetail = {
      ...FIXTURE,
      user: { name: 'Carlos' },
    };
    const result = parseOrder(raw);
    expect(result.customerName).toBe('Carlos');
  });
});

describe('isOrderEndpoint', () => {
  it('returns true for /api/v2/orders', () => {
    expect(isOrderEndpoint('https://merchant.pedidosya.com/api/v2/orders/98765')).toBe(true);
  });

  it('returns true for /v2/orders', () => {
    expect(isOrderEndpoint('https://merchant.pedidosya.com/v2/orders/123')).toBe(true);
  });

  it('returns true for /orders', () => {
    expect(isOrderEndpoint('https://merchant.pedidosya.com/orders/456')).toBe(true);
  });

  it('returns false for unrelated endpoint', () => {
    expect(isOrderEndpoint('https://merchant.pedidosya.com/api/v2/restaurants')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOrderEndpoint('')).toBe(false);
  });

  it('returns false for a completely unrelated URL', () => {
    expect(isOrderEndpoint('https://example.com/users')).toBe(false);
  });
});

describe('tryExtractOrder', () => {
  it('returns null when url does not match an order endpoint', () => {
    const result = tryExtractOrder('https://example.com/restaurants', FIXTURE);
    expect(result).toBeNull();
  });

  it('returns null when data is null', () => {
    const result = tryExtractOrder('https://merchant.pedidosya.com/api/v2/orders/1', null);
    expect(result).toBeNull();
  });

  it('returns null when data is a primitive (not an object)', () => {
    const result = tryExtractOrder('https://merchant.pedidosya.com/api/v2/orders/1', 'string-data');
    expect(result).toBeNull();
  });

  it('handles { order: {...} } wrapper structure', () => {
    const wrapped = { order: FIXTURE };
    const result = tryExtractOrder('https://merchant.pedidosya.com/api/v2/orders/98765', wrapped);
    expect(result).not.toBeNull();
    expect(result?.externalId).toBe('98765');
  });

  it('handles direct structure (no wrapper)', () => {
    const result = tryExtractOrder('https://merchant.pedidosya.com/api/v2/orders/98765', FIXTURE);
    expect(result).not.toBeNull();
    expect(result?.externalId).toBe('98765');
  });

  it('returns null when object has no id or total', () => {
    const unrecognized = { foo: 'bar', baz: 123 };
    const result = tryExtractOrder('https://merchant.pedidosya.com/api/v2/orders/1', unrecognized);
    expect(result).toBeNull();
  });

  it('returns null when parseOrder throws (malformed data)', () => {
    // Object has id and total but is missing required fields, causing parseOrder to throw
    const malformed = { id: 99, total: 100, orderDetails: null };
    const result = tryExtractOrder('https://merchant.pedidosya.com/api/v2/orders/99', malformed);
    expect(result).toBeNull();
  });
});
