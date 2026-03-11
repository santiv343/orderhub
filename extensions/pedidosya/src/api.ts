import type { ImportedOrder } from '@orderhub/types';

interface ApiConfig {
  apiUrl: string;
  apiKey: string;
}

export class OrderhubApiClient {
  constructor(private readonly config: ApiConfig) {}

  async importOrder(order: ImportedOrder): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/connectors/pedidosya/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey,
      },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Orderhub API error ${response.status}: ${body}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
