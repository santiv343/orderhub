import type { ImportedOrder, ImportedOrderItem } from '@orderhub/types';
import { OrderSource, OrderStatus } from '@orderhub/types';

// Parses raw PedidosYa order data into the ImportedOrder contract
export function parsePedidosYaOrder(raw: Record<string, unknown>): ImportedOrder {
  const items = parseItems(raw['products'] as unknown[] | undefined);

  const subtotal = Number(raw['subtotal'] ?? 0);
  const discounts = Number(raw['discounts'] ?? 0);
  const deliveryFee = Number(raw['deliveryFee'] ?? 0);
  const total = Number(raw['total'] ?? subtotal - discounts + deliveryFee);

  return {
    externalId: String(raw['id'] ?? ''),
    source: OrderSource.PEDIDOSYA,
    status: mapStatus(String(raw['state'] ?? '')),
    customerName: String(raw['user']?.['name'] ?? 'Unknown'),
    customerPhone: raw['user']?.['phone'] != null ? String(raw['user']['phone']) : undefined,
    customerAddress: raw['address']?.['description'] != null
      ? String(raw['address']['description'])
      : undefined,
    items,
    subtotal,
    discounts,
    deliveryFee,
    total,
    notes: raw['notes'] != null ? String(raw['notes']) : undefined,
    placedAt: new Date(String(raw['registeredDate'] ?? Date.now())),
    rawPayload: raw,
  };
}

function parseItems(products: unknown[] | undefined): ImportedOrderItem[] {
  if (!Array.isArray(products)) return [];

  return products.map((p) => {
    const product = p as Record<string, unknown>;
    const quantity = Number(product['quantity'] ?? 1);
    const unitPrice = Number(product['unitPrice'] ?? 0);
    return {
      externalId: String(product['id'] ?? ''),
      name: String(product['name'] ?? ''),
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      notes: product['comment'] != null ? String(product['comment']) : undefined,
    };
  });
}

function mapStatus(state: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    PENDING: OrderStatus.PENDING,
    CONFIRMED: OrderStatus.CONFIRMED,
    KITCHEN: OrderStatus.IN_PREPARATION,
    READY: OrderStatus.READY,
    DELIVERED: OrderStatus.DELIVERED,
    CANCELLED: OrderStatus.CANCELLED,
    REJECTED: OrderStatus.REJECTED,
  };
  return map[state] ?? OrderStatus.PENDING;
}
