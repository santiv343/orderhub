/**
 * content.ts — Content script (corre en isolated world de Chrome)
 *
 * 1. Lee config desde chrome.storage.sync
 * 2. Inyecta config en contexto de página como inline script (el isolated world
 *    no puede asignar a window directamente)
 * 3. Inyecta injected.js en contexto de página
 * 4. Relay: escucha postMessage y reenvía al background
 */

const DEFAULT_IGNORE_DOMAINS = [
  'google-analytics', 'googletagmanager', 'googlesyndication', 'doubleclick',
  'facebook.net', 'fbcdn.net', 'segment.io', 'sentry.io', 'hotjar.com',
  'intercom.io', 'mixpanel.com', 'amplitude.com', 'newrelic.com',
  'rollbar.com', 'logrocket.com', 'fullstory.com', 'datadoghq.com',
];

const ENUM_FIELD_NAMES = [
  'status', 'state', 'type', 'kind', 'source', 'role', 'category',
  'phase', 'stage', 'mode', 'format', 'method', 'reason', 'result',
  'priority', 'level', 'action', 'event', 'origin', 'channel',
];

chrome.storage.sync.get(
  { domains: [], ignoreDomains: DEFAULT_IGNORE_DOMAINS, maxDepth: 5, serverPort: 7733 },
  (stored) => {
    // 1. Inyectar config en contexto de página (inline script ejecuta sincrónico al agregarse al DOM)
    const snifferConfig = {
      domains: stored['domains'] as string[],
      ignoreDomains: stored['ignoreDomains'] as string[],
      maxDepth: stored['maxDepth'] as number,
      enumFieldNames: ENUM_FIELD_NAMES,
      maxEnumValues: 20,
      arraySampleSize: 3,
    };

    const configScript = document.createElement('script');
    configScript.textContent = `window.__SNIFFER_CONFIG__ = ${JSON.stringify(snifferConfig)};`;
    document.documentElement.prepend(configScript);
    configScript.remove(); // ya ejecutó, se puede limpiar

    // 2. Inyectar interceptor
    const injectedScript = document.createElement('script');
    injectedScript.src = chrome.runtime.getURL('injected.js');
    injectedScript.onload = () => injectedScript.remove();
    document.documentElement.prepend(injectedScript);
  },
);

// 3. Relay: reenviar capturas al background service worker
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'SNIFFER_CAPTURE') return;
  chrome.runtime.sendMessage(event.data).catch(() => {});
});
