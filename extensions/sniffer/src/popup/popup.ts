// Make this file a module to avoid global scope collisions with other scripts
export {};

const POPUP_DEFAULT_IGNORE_DOMAINS = [
  'google-analytics', 'googletagmanager', 'googlesyndication', 'doubleclick',
  'facebook.net', 'fbcdn.net', 'segment.io', 'sentry.io', 'hotjar.com',
  'intercom.io', 'mixpanel.com', 'amplitude.com', 'newrelic.com',
  'rollbar.com', 'logrocket.com', 'fullstory.com', 'datadoghq.com',
].join('\n');

async function init(): Promise<void> {
  // ── Cargar estado inicial ───────────────────────────────────────────────────
  const stored = await new Promise<Record<string, unknown>>((resolve) =>
    chrome.storage.sync.get(
      { domains: [], ignoreDomains: POPUP_DEFAULT_IGNORE_DOMAINS.split('\n'), serverPort: 7733, maxDepth: 5 },
      resolve,
    ),
  );
  const local = await new Promise<{ schemas: Record<string, unknown>; queue: unknown[] }>((resolve) =>
    chrome.storage.local.get({ schemas: {}, queue: [] }, (r) =>
      resolve(r as { schemas: Record<string, unknown>; queue: unknown[] }),
    ),
  );

  // ── Elementos del DOM ───────────────────────────────────────────────────────
  const dot = document.getElementById('dot')!;
  const statusText = document.getElementById('status-text')!;
  const schemaCount = document.getElementById('schema-count')!;
  const queueCount = document.getElementById('queue-count')!;
  const domainsInput = document.getElementById('domains') as HTMLTextAreaElement;
  const ignoreInput = document.getElementById('ignore-domains') as HTMLTextAreaElement;
  const portInput = document.getElementById('server-port') as HTMLInputElement;
  const depthInput = document.getElementById('max-depth') as HTMLInputElement;
  const saveBtn = document.getElementById('save-btn')!;
  const savedMsg = document.getElementById('saved-msg')!;
  const exportBtn = document.getElementById('export-btn')!;
  const clearBtn = document.getElementById('clear-btn')!;

  // ── Poblar campos ───────────────────────────────────────────────────────────
  domainsInput.value = (stored['domains'] as string[]).join('\n');
  ignoreInput.value = (stored['ignoreDomains'] as string[]).join('\n');
  portInput.value = String(stored['serverPort']);
  depthInput.value = String(stored['maxDepth']);

  // ── Stats ───────────────────────────────────────────────────────────────────
  schemaCount.textContent = String(Object.keys(local.schemas).length);
  queueCount.textContent = String(local.queue.length);

  // ── Server ping ─────────────────────────────────────────────────────────────
  async function checkServer(): Promise<void> {
    const port = parseInt(portInput.value, 10) || 7733;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/ping`);
      const data = (await res.json()) as { ok: boolean; endpoints: number };
      if (data.ok) {
        dot.className = 'dot connected';
        statusText.textContent = `Server online · ${data.endpoints} endpoints en disco`;
      } else {
        throw new Error();
      }
    } catch {
      dot.className = 'dot error';
      statusText.textContent = 'Server offline — ejecutá: node tools/sniffer-server.js';
    }
  }

  await checkServer();
  const pingInterval = setInterval(checkServer, 5000);
  // Limpiar interval cuando el popup se cierra
  window.addEventListener('unload', () => clearInterval(pingInterval));

  // ── Guardar config ──────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', async () => {
    const newConfig = {
      domains: domainsInput.value.split('\n').map((s) => s.trim()).filter(Boolean),
      ignoreDomains: ignoreInput.value.split('\n').map((s) => s.trim()).filter(Boolean),
      serverPort: parseInt(portInput.value, 10) || 7733,
      maxDepth: parseInt(depthInput.value, 10) || 5,
    };
    await new Promise<void>((resolve) => chrome.storage.sync.set(newConfig, resolve));
    savedMsg.style.display = 'block';
    setTimeout(() => (savedMsg.style.display = 'none'), 3000);
  });

  // ── Export fallback ─────────────────────────────────────────────────────────
  exportBtn.addEventListener('click', async () => {
    const { schemas } = await new Promise<{ schemas: Record<string, unknown> }>((resolve) =>
      chrome.storage.local.get({ schemas: {} }, (r) =>
        resolve(r as { schemas: Record<string, unknown> }),
      ),
    );
    const json = JSON.stringify(schemas, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schemas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ── Limpiar todo ────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', async () => {
    if (!confirm('¿Borrar todos los schemas capturados de chrome.storage?')) return;
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ schemas: {}, queue: [] }, resolve),
    );
    schemaCount.textContent = '0';
    queueCount.textContent = '0';
  });

  // ── Escuchar actualizaciones del background ─────────────────────────────────
  chrome.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type !== 'SNIFFER_STATS_UPDATE') return;
    chrome.storage.local.get({ schemas: {}, queue: [] }, (r) => {
      schemaCount.textContent = String(Object.keys(r['schemas'] as object).length);
      queueCount.textContent = String((r['queue'] as unknown[]).length);
    });
  });
}

init().catch(console.error);
