// Mock de chrome.* para tests unitarios.
// NOTA: los callbacks se llaman síncronamente en los mocks — a diferencia del runtime real
// de Chrome donde son asíncronos. Esto es aceptable para tests unitarios.
const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
};

(globalThis as Record<string, unknown>)['chrome'] = chromeMock;
