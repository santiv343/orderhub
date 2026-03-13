// Content script: corre en el contexto del content script (tiene acceso a chrome.*)
// 1. Inyecta injected.js en el contexto de la página
// 2. Escucha los CustomEvents que injected.js despacha
// 3. Delega los pedidos al background service worker

const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
document.documentElement.prepend(script);

window.addEventListener(
  'orderhub:intercepted',
  (event: Event) => {
    const { url, data } = (event as CustomEvent<{ url: string; data: unknown }>).detail;

    chrome.runtime.sendMessage({
      type: 'INTERCEPTED_REQUEST',
      payload: { url, data },
    });
  },
);

console.debug('[Orderhub] Content script activo en', location.href);
