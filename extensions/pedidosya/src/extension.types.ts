import type { ImportedOrder } from '@orderhub/types';

export interface QueueItem {
  id: string;           // UUID local generado al encolar
  order: ImportedOrder;
  attempts: number;
  lastAttemptAt: number | null;  // timestamp ms
  failedAt: number | null;       // timestamp ms — null si no superó MAX_ATTEMPTS
}

export interface StoredConfig {
  apiKey: string;
  backendUrl: string;
}

// Estructura asumida de la respuesta de PedidosYa Merchant
// IMPORTANTE: Verificar con tráfico real interceptado y actualizar parser.ts
export interface PedidosYaOrderDetail {
  id: number;
  code: string;
  state: string;
  registeredDate: string;   // ISO 8601
  notes?: string;
  user?: {
    name: string;
    lastName?: string;
    phoneNumber?: string;
  };
  address?: {
    description: string;
  };
  orderDetails: Array<{
    id: number;
    product: {
      id: number;
      name: string;
      integrationCode?: string;
    };
    unitaryPrice: number;
    amount: number;
    subTotal: number;
    notes?: string;
  }>;
  total: number;
  subtotal?: number;
  discountAmount?: number;
  shippingAmount?: number;
}

// Payload del CustomEvent que injected.ts despacha a content.ts
export interface InterceptedRequest {
  url: string;
  data: unknown;
}
