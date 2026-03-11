// Injected script — runs in page context, has access to page's JavaScript
// Used to intercept network requests or read page-level state

(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (...args): Promise<Response> {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? '';
      if (url.includes('/api/v1/orders') || url.includes('/orders/active')) {
        const clone = response.clone();
        const data: unknown = await clone.json();
        window.postMessage(
          {
            source: 'orderhub-injected',
            type: 'ORDER_DETECTED',
            payload: data,
          },
          '*',
        );
      }
    } catch {
      // Silently ignore parsing errors
    }

    return response;
  };
})();
