// Este archivo se inyecta en el contexto de la PÁGINA (no el content script).
// No puede importar módulos — no tiene acceso a chrome.* ni a constants.ts.
// Se comunica con el content script via window.dispatchEvent (CustomEvent).
// Importante: se ejecuta ANTES de que la SPA cargue (run_at: document_start).

(function () {
  'use strict';

  // Duplicado intencionalmente de PEDIDOSYA_ORDER_ENDPOINTS en constants.ts
  // (no se puede importar en contexto de página)
  const ORDER_URL_PATTERNS = ['/api/v2/orders', '/v2/orders', '/orders'];
  const isOrderUrl = (url: string): boolean =>
    ORDER_URL_PATTERNS.some((p) => url.includes(p));

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await originalFetch(...args);
    const input = args[0];
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = input.toString();
    }

    // Solo interceptar URLs de pedidos — evitar ruido de analytics, CDN, etc.
    if (isOrderUrl(url)) {
      response.clone().json()
        .then((data: unknown) => {
          window.dispatchEvent(
            new CustomEvent('orderhub:intercepted', {
              detail: { url, data },
            }),
          );
        })
        .catch(() => {
          // Silenciar — respuesta no JSON en endpoint de pedidos
        });
    }

    return response;
  };

  // Log para verificar que la intercepción está activa (solo en dev)
  console.debug('[Orderhub] Fetch interceptor instalado');
})();
