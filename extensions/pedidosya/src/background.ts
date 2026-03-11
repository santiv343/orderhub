// Background service worker
// Handles API calls, storage, and coordination between tabs

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Orderhub] Extension installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ORDER_DETECTED') {
    handleOrderDetected(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch((err: unknown) => {
        console.error('[Orderhub] Error handling order:', err);
        sendResponse({ success: false });
      });
    return true; // Keep channel open for async response
  }
});

async function handleOrderDetected(payload: unknown): Promise<void> {
  const { apiKey, apiUrl } = await getConfig();

  const response = await fetch(`${apiUrl}/connectors/pedidosya/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
}

async function getConfig(): Promise<{ apiKey: string; apiUrl: string }> {
  const result = await chrome.storage.sync.get(['apiKey', 'apiUrl']);
  return {
    apiKey: (result['apiKey'] as string | undefined) ?? '',
    apiUrl: (result['apiUrl'] as string | undefined) ?? 'http://localhost:3000',
  };
}
