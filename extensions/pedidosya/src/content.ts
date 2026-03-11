// Content script — runs in PedidosYa page context
// Communicates with the injected script and background service worker

const INJECTED_SCRIPT_URL = chrome.runtime.getURL('injected.js');

function injectScript(src: string): void {
  const script = document.createElement('script');
  script.src = src;
  script.type = 'module';
  (document.head ?? document.documentElement).appendChild(script);
  script.addEventListener('load', () => script.remove());
}

// Inject the script that runs in page context (has access to page's JS)
injectScript(INJECTED_SCRIPT_URL);

// Listen for messages from injected script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== 'orderhub-injected') return;

  // Forward to background service worker
  chrome.runtime.sendMessage(event.data);
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  window.postMessage({ source: 'orderhub-content', ...message }, '*');
});
