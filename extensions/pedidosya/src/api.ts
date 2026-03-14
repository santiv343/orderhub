import type { ImportedOrder } from '@orderhub/types';

interface ImportResult {
  imported: number;
  duplicates: number;
}

interface ApiError {
  error: { code: string; message: string };
}

// Convierte ImportedOrder al contrato del backend (placedAt como ISO string)
function toBackendDto(order: ImportedOrder) {
  return {
    ...order,
    placedAt: order.placedAt instanceof Date
      ? order.placedAt.toISOString()
      : order.placedAt,
  };
}

export async function sendOrders(
  orders: ImportedOrder[],
  apiKey: string,
  backendUrl: string,
): Promise<ImportResult> {
  const response = await fetch(`${backendUrl}/integrations/orders/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ orders: orders.map(toBackendDto) }),
  });

  const data = (await response.json()) as ImportResult | ApiError;

  if (!response.ok) {
    const err = data as ApiError;
    throw new Error(err.error?.code ?? `HTTP ${response.status}`);
  }

  return data as ImportResult;
}
