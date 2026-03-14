/**
 * injected.ts — API Schema Interceptor
 *
 * Corre en el contexto de la página (no en el isolated world de la extensión).
 * Config inyectada por content.ts via window.__SNIFFER_CONFIG__.
 * Envía capturas a content.ts via window.postMessage.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

interface SnifferConfig {
  domains: string[];
  ignoreDomains: string[];
  maxDepth: number;
  enumFieldNames: string[];
  maxEnumValues: number;
  arraySampleSize: number;
}

interface EndpointEntry {
  schema: unknown;
  calls: number;
  firstSeen: string;
  lastSeen: string;
  enumValues?: Record<string, string[]>;
  queryParams?: Record<string, string>;
  statusCodesSeen?: number[];
}

declare global {
  interface Window {
    __SNIFFER_CONFIG__?: SnifferConfig;
  }
}

// ── Config (inyectada por content.ts, con fallback) ───────────────────────────

const DEFAULT_IGNORE_DOMAINS = [
  'google-analytics', 'googletagmanager', 'googlesyndication', 'doubleclick', 'google.com/pagead',
  'facebook.net', 'fbcdn.net', 'connect.facebook',
  'segment.io', 'segment.com',
  'sentry.io', 'sentry-cdn', 'ingest.sentry',
  'hotjar.com', 'static.hotjar',
  'intercom.io', 'intercomcdn.com',
  'mixpanel.com',
  'amplitude.com', 'api.amplitude',
  'newrelic.com', 'nr-data',
  'rollbar.com',
  'logrocket.com',
  'fullstory.com',
  'datadoghq.com', 'browser-intake-datadoghq',
  'twitter.com', 'ads-twitter',
  'crisp.chat', 'client.crisp',
];

const cfg: SnifferConfig = window.__SNIFFER_CONFIG__ ?? {
  domains: [],
  ignoreDomains: DEFAULT_IGNORE_DOMAINS,
  maxDepth: 5,
  enumFieldNames: [
    'status', 'state', 'type', 'kind', 'source', 'role', 'category',
    'phase', 'stage', 'mode', 'format', 'method', 'reason', 'result',
    'priority', 'level', 'action', 'event', 'origin', 'channel',
  ],
  maxEnumValues: 20,
  arraySampleSize: 3,
};

// ── Estado en memoria (por sesión de página) ──────────────────────────────────

const endpoints: Record<string, EndpointEntry> = {};

// ── Emit ──────────────────────────────────────────────────────────────────────

function emit(endpoint: string, entry: EndpointEntry): void {
  window.postMessage({ type: 'SNIFFER_CAPTURE', payload: { endpoint, schema: entry } }, '*');
}

// ── Log ───────────────────────────────────────────────────────────────────────

function logCapture(key: string, calls: number): void {
  console.log(`[Sniffer] ✓ ${key} (${calls}x)`);
}

// ── Filtro de dominio ─────────────────────────────────────────────────────────

function shouldCapture(url: string): boolean {
  if (cfg.ignoreDomains.some((d) => url.includes(d))) return false;
  if (!cfg.domains.length) return true;
  return cfg.domains.some((d) => url.includes(d));
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function resolveUrl(rawUrl: string): string {
  if (rawUrl.startsWith('http')) return rawUrl;
  try { return new URL(rawUrl, window.location.href).href; } catch { return rawUrl; }
}

function normalize(rawUrl: string): string {
  try {
    const u = new URL(resolveUrl(rawUrl));
    const path = u.pathname
      .replace(/\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi, '/:uuid')
      .replace(/\/\d+/g, '/:id');
    return u.origin + path;
  } catch { return rawUrl.replace(/\/\d+/g, '/:id'); }
}

function extractQueryParams(rawUrl: string): Record<string, string> | null {
  try {
    const u = new URL(resolveUrl(rawUrl));
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      params[k] = isNaN(Number(v)) || v === '' ? 'string' : 'number';
    });
    return Object.keys(params).length ? params : null;
  } catch { return null; }
}

// ── Schema recursivo ──────────────────────────────────────────────────────────

function mergeSchemas(a: unknown, b: unknown): unknown {
  if (typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return a;
  const result = { ...(a as Record<string, unknown>) };
  for (const k of Object.keys(b as Record<string, unknown>)) {
    if (!(k in result)) result[k] = (b as Record<string, unknown>)[k];
  }
  return result;
}

function extractSchema(value: unknown, depth: number): unknown {
  if (depth > cfg.maxDepth) return '(max depth)';
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (!value.length) return [];
    const n = Math.min(cfg.arraySampleSize, value.length);
    let sample = extractSchema(value[0], depth + 1);
    for (let i = 1; i < n; i++) sample = mergeSchemas(sample, extractSchema(value[i], depth + 1));
    return [sample];
  }
  if (typeof value === 'object') {
    const s: Record<string, unknown> = {};
    for (const k of Object.keys(value as object)) {
      s[k] = extractSchema((value as Record<string, unknown>)[k], depth + 1);
    }
    return s;
  }
  return typeof value;
}

// ── Enum values ───────────────────────────────────────────────────────────────

type EnumAccumulator = Record<string, Set<string>>;

function collectEnumValues(obj: unknown, accumulated: EnumAccumulator): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach((item) => collectEnumValues(item, accumulated)); return; }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const fieldName = k.toLowerCase();
    const isEnumField = cfg.enumFieldNames.some((n) =>
      fieldName === n ||
      fieldName.endsWith('_' + n) ||
      k.endsWith(n.charAt(0).toUpperCase() + n.slice(1))
    );
    if (isEnumField && typeof v === 'string' && v.length > 0 && v.length < 50) {
      if (!accumulated[k]) accumulated[k] = new Set();
      if (accumulated[k].size < cfg.maxEnumValues) accumulated[k].add(v);
    }
    if (v && typeof v === 'object') collectEnumValues(v, accumulated);
  }
}

// ── Registro central ──────────────────────────────────────────────────────────

function record(
  key: string,
  schema: unknown,
  opts: { queryParams?: Record<string, string> | null; statusCode?: number; rawData?: unknown } = {},
): void {
  const now = new Date().toISOString();
  const prev = endpoints[key];

  // Acumular enum values (restaurar Sets desde arrays si viene de prev serializado)
  const enumAccumulator: EnumAccumulator = {};
  if (prev?.enumValues) {
    for (const [k, vals] of Object.entries(prev.enumValues)) {
      enumAccumulator[k] = new Set(vals);
    }
  }
  if (opts.rawData) collectEnumValues(opts.rawData, enumAccumulator);
  const enumsSerialized: Record<string, string[]> = {};
  for (const [k, s] of Object.entries(enumAccumulator)) {
    if (s.size > 0 && s.size <= cfg.maxEnumValues) enumsSerialized[k] = [...s].sort();
  }

  // Status codes vistos
  const statuses = new Set(prev?.statusCodesSeen ?? []);
  if (opts.statusCode) statuses.add(opts.statusCode);

  const entry: EndpointEntry = {
    schema,
    calls: (prev?.calls ?? 0) + 1,
    firstSeen: prev?.firstSeen ?? now,
    lastSeen: now,
    ...(Object.keys(enumsSerialized).length ? { enumValues: enumsSerialized } : {}),
    ...(opts.queryParams ? { queryParams: opts.queryParams }
      : prev?.queryParams ? { queryParams: prev.queryParams } : {}),
    ...(statuses.size ? { statusCodesSeen: [...statuses].sort() } : {}),
  };

  endpoints[key] = entry;
  emit(key, entry);
  logCapture(key, entry.calls);
}

// Para WS/SSE: merge de schemas de distintos mensajes del mismo canal
function recordMerge(key: string, schema: unknown, rawData: unknown): void {
  const now = new Date().toISOString();
  const prev = endpoints[key];
  const merged = prev?.schema && typeof prev.schema === 'object' && !Array.isArray(prev.schema)
    ? mergeSchemas(prev.schema, schema) : schema;

  const enumAccumulator: EnumAccumulator = {};
  if (prev?.enumValues) {
    for (const [k, vals] of Object.entries(prev.enumValues)) {
      enumAccumulator[k] = new Set(vals);
    }
  }
  collectEnumValues(rawData, enumAccumulator);
  const enumsSerialized: Record<string, string[]> = {};
  for (const [k, s] of Object.entries(enumAccumulator)) {
    if (s.size > 0 && s.size <= cfg.maxEnumValues) enumsSerialized[k] = [...s].sort();
  }

  const entry: EndpointEntry = {
    schema: merged,
    calls: (prev?.calls ?? 0) + 1,
    firstSeen: prev?.firstSeen ?? now,
    lastSeen: now,
    ...(Object.keys(enumsSerialized).length ? { enumValues: enumsSerialized } : {}),
  };

  endpoints[key] = entry;
  emit(key, entry);
  logCapture(key, entry.calls);
}

// ── GraphQL helpers ───────────────────────────────────────────────────────────

function isGraphQL(url: string, body: unknown): body is { query: string; operationName?: string } {
  return (url.includes('/graphql') || url.includes('/api/query')) &&
    !!body && typeof body === 'object' && !Array.isArray(body) && 'query' in (body as object);
}

function gqlKey(url: string, body: { operationName?: string }): string {
  return `GQL ${normalize(url)} [${body.operationName ?? 'anonymous'}]`;
}

// ── Body parsing ──────────────────────────────────────────────────────────────

function parseBody(raw: unknown): unknown {
  if (!raw || raw instanceof ReadableStream) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw as string); } catch { return null; }
}

// ── Captura HTTP ──────────────────────────────────────────────────────────────

function captureResponse(
  method: string,
  url: string,
  status: number,
  contentType: string,
  rawBody: unknown,
  reqBody: unknown,
  getHeader: (h: string) => string | null,
): void {
  if (!shouldCapture(url)) return;
  if (status < 200 || status >= 300) return;
  if (!contentType || !contentType.includes('application/json')) return;
  const parsedBody = parseBody(rawBody);
  if (!parsedBody) return;

  const schema = extractSchema(parsedBody, 0);
  const qp = extractQueryParams(url);
  const _ = getHeader; // headers ignorados (CORS los bloquea en mayoría de casos)

  if (isGraphQL(url, reqBody)) {
    record(gqlKey(url, reqBody), schema, { queryParams: qp, statusCode: status, rawData: parsedBody });
  } else {
    record(`${method} ${normalize(url)}`, schema, { queryParams: qp, statusCode: status, rawData: parsedBody });
  }
}

function captureRequest(method: string, url: string, reqBody: unknown): void {
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return;
  if (!shouldCapture(url) || !reqBody || typeof reqBody !== 'object') return;
  if (isGraphQL(url, reqBody)) return;
  record(`REQ ${method} ${normalize(url)}`, extractSchema(reqBody, 0), { rawData: reqBody });
}

// ── Stealth ───────────────────────────────────────────────────────────────────

function stealthSet(obj: Window, prop: string, patched: unknown, original: unknown): void {
  if (original) (patched as { toString(): string }).toString = () => String(original);
  Object.defineProperty(obj, prop, { value: patched, writable: true, configurable: true });
}

// ── Override: fetch ───────────────────────────────────────────────────────────

const _fetch = window.fetch;

async function patchedFetch(this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
  const input = args[0];
  const init = args[1] ?? {};
  const url = typeof input === 'string' ? input
    : (input instanceof Request ? input.url : String(input));
  const method = ((init.method ?? (input instanceof Request ? input.method : null)) ?? 'GET').toUpperCase();
  const rawReqBody = init.body ?? (input instanceof Request ? input.body : null);
  const reqBody = parseBody(rawReqBody);

  if (shouldCapture(url) && reqBody) captureRequest(method, url, reqBody);

  const response = await _fetch.apply(this, args);

  if (shouldCapture(url)) {
    const clone = response.clone();
    const ct = clone.headers.get('content-type') ?? '';
    clone.text().then((body) => {
      captureResponse(method, url, response.status, ct, body, reqBody,
        (h) => response.headers.get(h));
    }).catch(() => {});
  }

  return response;
}

stealthSet(window, 'fetch', patchedFetch, _fetch);

// ── Override: XMLHttpRequest ──────────────────────────────────────────────────

const _XHR = window.XMLHttpRequest;

function PatchedXHR(this: XMLHttpRequest): XMLHttpRequest {
  const xhr = new _XHR();
  let _method = 'GET';
  let _url = '';
  let _reqBody: unknown = null;

  const _open = xhr.open;
  xhr.open = function (
    method: string, url: string,
    async?: boolean, user?: string, password?: string,
  ) {
    _method = (method ?? 'GET').toUpperCase();
    _url = url ?? '';
    return _open.call(xhr, method, url, async, user, password);
  };

  const _send = xhr.send;
  xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    _reqBody = body;
    const reqBody = parseBody(body);
    if (reqBody) captureRequest(_method, resolveUrl(_url), reqBody);
    return _send.apply(xhr, [body]);
  };

  xhr.addEventListener('load', function () {
    const resolvedUrl = resolveUrl(_url);
    const ct = xhr.getResponseHeader('content-type') ?? '';
    captureResponse(_method, resolvedUrl, xhr.status, ct, xhr.responseText, parseBody(_reqBody),
      (h) => xhr.getResponseHeader(h));
  });

  return xhr;
}

Object.setPrototypeOf(PatchedXHR, _XHR);
PatchedXHR.prototype = _XHR.prototype;
PatchedXHR.toString = () => _XHR.toString();
Object.defineProperty(window, 'XMLHttpRequest', { value: PatchedXHR, writable: true, configurable: true });

// ── Override: WebSocket ───────────────────────────────────────────────────────

const _WS = window.WebSocket;

function PatchedWS(this: unknown, url: string, protocols?: string | string[]): WebSocket {
  const ws = protocols !== undefined ? new _WS(url, protocols) : new _WS(url);
  if (shouldCapture(url)) {
    const key = `WS ${normalize(url)}`;
    ws.addEventListener('message', (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      const parsed = parseBody(e.data);
      if (parsed) recordMerge(key, extractSchema(parsed, 0), parsed);
    });
  }
  return ws;
}

Object.setPrototypeOf(PatchedWS, _WS);
PatchedWS.prototype = _WS.prototype;
PatchedWS.toString = () => _WS.toString();
Object.defineProperty(window, 'WebSocket', { value: PatchedWS, writable: true, configurable: true });

// ── Override: EventSource (SSE) ───────────────────────────────────────────────

if (typeof window.EventSource !== 'undefined') {
  const _ES = window.EventSource;

  function PatchedES(this: unknown, url: string, opts?: EventSourceInit): EventSource {
    const es = opts !== undefined ? new _ES(url, opts) : new _ES(url);
    if (shouldCapture(url)) {
      const key = `SSE ${normalize(url)}`;
      es.addEventListener('message', (e: MessageEvent) => {
        const parsed = parseBody(e.data);
        if (parsed) recordMerge(key, extractSchema(parsed, 0), parsed);
      });
    }
    return es;
  }

  Object.setPrototypeOf(PatchedES, _ES);
  PatchedES.prototype = _ES.prototype;
  PatchedES.toString = () => _ES.toString();
  Object.defineProperty(window, 'EventSource', { value: PatchedES, writable: true, configurable: true });
}

console.log('[Sniffer] Interceptor activo',
  cfg.domains.length ? `— filtrando: [${cfg.domains.join(', ')}]` : '— capturando todo');
