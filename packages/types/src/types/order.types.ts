import type { OrderSource, OrderStatus } from '../enums/index';

export interface ImportedOrderItem {
  externalId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface ImportedOrder {
  externalId: string;
  source: OrderSource;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: ImportedOrderItem[];
  subtotal: number;
  discounts: number;
  deliveryFee: number;
  total: number;
  notes?: string;
  placedAt: Date;
  rawPayload: Record<string, unknown>;
}
