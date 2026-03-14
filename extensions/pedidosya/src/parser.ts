import { OrderSource, OrderStatus } from '@orderhub/types';
import type { ImportedOrder, ImportedOrderItem } from '@orderhub/types';
import type { PedidosYaOrderDetail } from './extension.types';
import { PEDIDOSYA_ORDER_ENDPOINTS } from './constants';

export function isOrderEndpoint(url: string): boolean {
  return PEDIDOSYA_ORDER_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

function mapItem(detail: PedidosYaOrderDetail['orderDetails'][number]): ImportedOrderItem {
  return {
    externalId: String(detail.id),
    name: detail.product.name,
    quantity: detail.amount,
    unitPrice: detail.unitaryPrice,
    totalPrice: detail.subTotal,
    notes: detail.notes,
  };
}

function buildCustomerName(user: PedidosYaOrderDetail['user']): string {
  if (!user) return 'Cliente PedidosYa';
  const parts = [user.name, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Cliente PedidosYa';
}

export function parseOrder(raw: PedidosYaOrderDetail): ImportedOrder {
  return {
    externalId: String(raw.id),
    source: OrderSource.PEDIDOSYA,
    status: OrderStatus.PENDING,
    customerName: buildCustomerName(raw.user),
    customerPhone: raw.user?.phoneNumber,
    customerAddress: raw.address?.description,
    items: raw.orderDetails.map(mapItem),
    subtotal: raw.subtotal ?? raw.total,
    discounts: raw.discountAmount ?? 0,
    deliveryFee: raw.shippingAmount ?? 0,
    total: raw.total,
    notes: raw.notes,
    placedAt: new Date(raw.registeredDate),
    rawPayload: raw as Record<string, unknown>,
  };
}

function extractOrderData(data: Record<string, unknown>): Record<string, unknown> | null {
  // Handle { order: {...} } wrapper structure
  if (typeof data['order'] === 'object' && data['order'] !== null) {
    return data['order'] as Record<string, unknown>;
  }
  // Direct structure
  return data;
}

export function tryExtractOrder(url: string, data: unknown): ImportedOrder | null {
  if (!isOrderEndpoint(url)) return null;
  if (typeof data !== 'object' || data === null) return null;

  const orderData = extractOrderData(data as Record<string, unknown>);

  if (!orderData?.['id'] || !orderData?.['total']) return null;

  try {
    return parseOrder(orderData as unknown as PedidosYaOrderDetail);
  } catch {
    return null;
  }
}
