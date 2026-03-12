export const QUERY_KEYS = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (filters?: Record<string, unknown>) => ['orders', 'list', filters] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  products: {
    all: ['products'] as const,
    list: (locationId: string) => ['products', 'list', locationId] as const,
  },
  expenses: {
    all: ['expenses'] as const,
    list: (locationId: string, date?: string) => ['expenses', 'list', locationId, date] as const,
  },
  dailyClose: {
    all: ['daily-close'] as const,
    detail: (locationId: string, date: string) => ['daily-close', locationId, date] as const,
  },
  locations: {
    all: ['locations'] as const,
    detail: (id: string) => ['locations', 'detail', id] as const,
  },
  connectors: {
    all: ['connectors'] as const,
    list: (locationId: string) => ['connectors', 'list', locationId] as const,
  },
} as const;
