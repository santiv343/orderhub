export const STORAGE_KEYS = {
  API_KEY: 'orderhub_api_key',
  BACKEND_URL: 'orderhub_backend_url',
  QUEUE: 'orderhub_queue',
} as const;

export const DEFAULTS = {
  BACKEND_URL: 'https://api.orderhub.app/api/v1',
} as const;

export const RETRY = {
  MAX_ATTEMPTS: 10,
  // Backoff en ms: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s, 60s
  DELAYS: [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000, 60000],
} as const;

// Endpoints de PedidosYa que contienen datos de pedidos
// IMPORTANTE: Verificar con tráfico real y actualizar si cambia
export const PEDIDOSYA_ORDER_ENDPOINTS = [
  '/api/v2/orders',
  '/v2/orders',
  '/orders',
] as const;

export const MESSAGE_TYPES = {
  INTERCEPTED_REQUEST: 'INTERCEPTED_REQUEST',
} as const;
