/**
 * background.ts — Service Worker MV3
 *
 * - Recibe SNIFFER_CAPTURE desde content scripts
 * - Mergea schema en chrome.storage.local (fuente de verdad)
 * - Intenta POST /schema al servidor local inmediatamente
 * - Si falla: agrega a pendingQueue en chrome.storage.local
 * - chrome.alarms cada 1 min: flush del queue pendiente
 */

const ALARM_NAME = 'sniffer-queue-flush';

interface SchemaCapture {
  endpoint: string;
  schema: unknown;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

// In-memory cache eliminates read-modify-write races (JS is single-threaded;
// all async gaps are between awaits, not between cache reads and writes)
let schemasCache: Record<string, unknown> | null = null;
let queueCache: SchemaCapture[] | null = null;

function getPort(): Promise<number> {
  return new Promise((resolve) =>
    chrome.storage.sync.get({ serverPort: 7733 }, (c) => resolve(c['serverPort'] as number)),
  );
}

async function getSchemas(): Promise<Record<string, unknown>> {
  if (schemasCache) return schemasCache;
  return new Promise((resolve) =>
    chrome.storage.local.get({ schemas: {} }, (c) => {
      schemasCache = c['schemas'] as Record<string, unknown>;
      resolve(schemasCache);
    }),
  );
}

async function saveSchemas(schemas: Record<string, unknown>): Promise<void> {
  schemasCache = schemas;
  return new Promise((resolve) => chrome.storage.local.set({ schemas }, resolve));
}

async function getQueue(): Promise<SchemaCapture[]> {
  if (queueCache) return queueCache;
  return new Promise((resolve) =>
    chrome.storage.local.get({ queue: [] }, (c) => {
      queueCache = c['queue'] as SchemaCapture[];
      resolve(queueCache);
    }),
  );
}

async function saveQueue(queue: SchemaCapture[]): Promise<void> {
  queueCache = queue;
  return new Promise((resolve) => chrome.storage.local.set({ queue }, resolve));
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: { type: string; payload?: unknown }) => {
  if (message.type !== 'SNIFFER_CAPTURE') return;
  if (!message.payload || typeof message.payload !== 'object') return;
  const { endpoint, schema } = message.payload as SchemaCapture;
  if (!endpoint || typeof endpoint !== 'string') return;
  handleCapture(endpoint, schema).catch(console.error);
});

async function handleCapture(endpoint: string, schema: unknown): Promise<void> {
  // 1. Mergear en chrome.storage.local (fuente de verdad — sobrevive si el SW es killed)
  const schemas = await getSchemas();
  schemas[endpoint] = schema;
  await saveSchemas(schemas);

  // 2. Intentar enviar al servidor local
  const port = await getPort();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, schema }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Notificar al popup si está abierto
    chrome.runtime.sendMessage({ type: 'SNIFFER_STATS_UPDATE' }).catch(() => {});
  } catch {
    // Servidor caído — agregar a la cola
    const queue = await getQueue();
    queue.push({ endpoint, schema });
    await saveQueue(queue);
  }
}

// ── Queue flush via chrome.alarms ─────────────────────────────────────────────
// chrome.alarms tiene un mínimo de 1 minuto en MV3 (setInterval no funciona en SW)

// Only create if it doesn't already exist — recreating resets the timer,
// which would prevent the flush from ever firing during active capture sessions
chrome.alarms.get(ALARM_NAME, (existing) => {
  if (!existing) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) flushQueue().catch(console.error);
});

async function flushQueue(): Promise<void> {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const port = await getPort();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/schemas/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queue),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await saveQueue([]);
    chrome.runtime.sendMessage({ type: 'SNIFFER_STATS_UPDATE' }).catch(() => {});
  } catch {
    // Servidor sigue caído — reintentar en el próximo tick del alarm
  }
}
