export const LIMITS = {
  pagination: {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 100,
  },
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  },
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    extensionMaxRequestsPerMinute: 60,
  },
  orders: {
    maxItemsPerOrder: 50,
    importBatchSize: 10,
  },
  upload: {
    maxFileSizeBytes: 5 * 1024 * 1024,
  },
} as const;
