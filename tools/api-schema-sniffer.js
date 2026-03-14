/**
 * API Schema Sniffer — DevTools Snippet
 * =======================================
 * Intercepta todo el tráfico de red de una web app y extrae:
 *   - Schema recursivo de responses (tipos, no valores)
 *   - Valores reales de campos que parecen enums (status, type, state, etc.)
 *   - Query params con sus tipos
 *   - Request body schemas (POST/PUT/PATCH)
 *   - Headers de respuesta relevantes (paginación, custom x-headers)
 *   - HTTP status codes vistos por endpoint
 *   - Hit counter + timestamps
 *
 * PROTOCOLOS: fetch · XMLHttpRequest · WebSocket · EventSource (SSE) · GraphQL
 *
 * COMANDOS:
 *   exportSchemas()        → descarga JSON + copia al clipboard
 *   showSchemas()          → lista endpoints en Console
 *   annotate("tu nota")    → marca un momento (ej: "llegó pedido nuevo")
 *   clearSchemas()         → borra todo
 *
 * Si recarga: re-ejecutar el snippet (carga lo acumulado desde localStorage)
 */

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const CONFIG = {
  // Dominios a capturar. [] = captura todo excepto ignoreDomains.
  // Ejemplo: ['pedidosya.com', 'pedidosya.com.ar']
  domains: [],

  // Dominios ignorados siempre (analytics, tracking, monitoring, etc.)
  ignoreDomains: [
    'google-analytics', 'googletagmanager', 'googlesyndication', 'doubleclick', 'google.com/pagead',
    'facebook.net', 'fbcdn.net', 'connect.facebook',
    'segment.io', 'segment.com',
    'sentry.io', 'sentry-cdn', 'ingest.sentry',
    'hotjar.com', 'static.hotjar',
    'intercom.io', 'intercomcdn.com', 'widget.intercom',
    'mixpanel.com',
    'amplitude.com', 'api.amplitude',
    'newrelic.com', 'nr-data',
    'rollbar.com',
    'logrocket.com',
    'fullstory.com',
    'pingdom.net',
    'datadoghq.com', 'browser-intake-datadoghq',
    'appcues.com',
    'heapanalytics.com', 'heap.io',
    'pendo.io',
    'clarity.ms',
    'twitter.com', 'ads-twitter', 't.co',
    'linkedin.com', 'licdn',
    'crisp.chat', 'client.crisp',
  ],

  // Qué capturar
  capture: {
    fetch: true,
    xhr: true,
    websocket: true,
    sse: true,
    requestBodies: true,  // schemas de POST/PUT/PATCH bodies
    graphql: true,        // agrupa por operationName
    queryParams: true,    // nombres de query params (no valores)
    enumValues: true,     // valores reales de campos que parecen enums
    responseHeaders: true,// headers de respuesta relevantes
    statusCodes: true,    // HTTP status codes vistos por endpoint
  },

  // Campos cuyo nombre sugiere que son enums (se capturan valores reales)
  enumFieldNames: [
    'status', 'state', 'type', 'kind', 'source', 'role', 'category',
    'phase', 'stage', 'mode', 'format', 'method', 'reason', 'result',
    'priority', 'level', 'action', 'event', 'origin', 'channel',
  ],

  // Máximo de valores distintos a guardar por campo enum (si supera → no es enum)
  maxEnumValues: 20,

  // Cuántos elementos de un array samplear (merge de los primeros N)
  arraySampleSize: 3,

  // Stealth: preserva .toString() en overrides para parecer código nativo
  stealth: true,

  maxDepth: 5,
  storageKey: 'sniffer_schemas',
};
// ─────────────────────────────────────────────────────────────────────────────

(function run(cfg) {
  // ── Estado ──────────────────────────────────────────────────────────────────
  let data = load();
  const endpointCount = Object.keys(data.endpoints || {}).length;
  log(
    `Iniciado. ${endpointCount} endpoints ya capturados.` +
    (cfg.domains.length ? ` Filtro: [${cfg.domains.join(', ')}]` : ' Sin filtro de dominio.'),
  );
  log('Comandos: exportSchemas() · showSchemas() · annotate("nota") · clearSchemas()');

  function log(msg) { console.log(`[Sniffer] ${msg}`); }
  function logCapture(key, calls) { console.log(`[Sniffer] ✓ ${key} (${calls}x)`); }

  // ── Persistencia ─────────────────────────────────────────────────────────────
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(cfg.storageKey) || '{}');
      return { endpoints: raw.endpoints || {}, annotations: raw.annotations || [] };
    } catch { return { endpoints: {}, annotations: [] }; }
  }

  function save() {
    localStorage.setItem(cfg.storageKey, JSON.stringify(data, null, 2));
  }

  // ── Filtro de dominio ─────────────────────────────────────────────────────────
  function shouldCapture(url) {
    if (cfg.ignoreDomains.some((d) => url.includes(d))) return false;
    if (!cfg.domains.length) return true;
    return cfg.domains.some((d) => url.includes(d));
  }

  // ── URL helpers ───────────────────────────────────────────────────────────────
  function resolve(rawUrl) {
    if (rawUrl.startsWith('http')) return rawUrl;
    try { return new URL(rawUrl, window.location.href).href; } catch { return rawUrl; }
  }

  function normalize(rawUrl) {
    try {
      const u = new URL(resolve(rawUrl));
      const path = u.pathname
        .replace(/\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi, '/:uuid')
        .replace(/\/\d+/g, '/:id');
      return u.origin + path;
    } catch { return rawUrl.replace(/\/\d+/g, '/:id'); }
  }

  function extractQueryParams(rawUrl) {
    if (!cfg.capture.queryParams) return null;
    try {
      const u = new URL(resolve(rawUrl));
      const params = {};
      u.searchParams.forEach((v, k) => { params[k] = isNaN(Number(v)) || v === '' ? 'string' : 'number'; });
      return Object.keys(params).length ? params : null;
    } catch { return null; }
  }

  // ── Schema recursivo ──────────────────────────────────────────────────────────
  function mergeSchemas(a, b) {
    if (typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return a;
    const result = { ...a };
    for (const k of Object.keys(b)) { if (!(k in result)) result[k] = b[k]; }
    return result;
  }

  function extractSchema(value, depth) {
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
      const s = {};
      for (const k of Object.keys(value)) s[k] = extractSchema(value[k], depth + 1);
      return s;
    }
    return typeof value;
  }

  // ── Detección de enum values ──────────────────────────────────────────────────
  // Recorre el objeto y recolecta valores reales de campos con nombres de enum
  function collectEnumValues(obj, accumulated) {
    if (!cfg.capture.enumValues || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach((item) => collectEnumValues(item, accumulated)); return; }
    for (const [k, v] of Object.entries(obj)) {
      const fieldName = k.toLowerCase();
      const isEnumField = cfg.enumFieldNames.some((n) => fieldName === n || fieldName.endsWith('_' + n) || fieldName.endsWith(n.charAt(0).toUpperCase() + n.slice(1)));
      if (isEnumField && typeof v === 'string' && v.length > 0 && v.length < 50) {
        if (!accumulated[k]) accumulated[k] = new Set();
        if (accumulated[k].size < cfg.maxEnumValues) accumulated[k].add(v);
      }
      if (v && typeof v === 'object') collectEnumValues(v, accumulated);
    }
  }

  // ── Response headers relevantes ───────────────────────────────────────────────
  function extractRelevantHeaders(getHeader) {
    if (!cfg.capture.responseHeaders) return null;
    const relevant = {};
    // Headers de paginación comunes
    const paginationHeaders = ['x-total-count', 'x-total', 'x-page', 'x-per-page',
      'x-page-count', 'x-next-page', 'link', 'x-pagination'];
    paginationHeaders.forEach((h) => {
      const v = getHeader(h);
      if (v !== null) relevant[h] = v;
    });
    return Object.keys(relevant).length ? relevant : null;
  }

  // ── Registro central ──────────────────────────────────────────────────────────
  function record(key, schema, { queryParams, headers, statusCode, rawData } = {}) {
    const now = new Date().toISOString();
    const prev = data.endpoints[key] || {};

    // Acumular enum values
    const enumVals = prev.enumValues ? JSON.parse(JSON.stringify(prev.enumValues)) : {};
    // Restaurar Sets
    for (const k of Object.keys(enumVals)) enumVals[k] = new Set(enumVals[k]);
    if (rawData) collectEnumValues(rawData, enumVals);
    // Serializar Sets a arrays ordenados
    const enumsSerialized = {};
    for (const [k, s] of Object.entries(enumVals)) {
      if (s.size > 0 && s.size <= cfg.maxEnumValues) enumsSerialized[k] = [...s].sort();
    }

    // Status codes vistos
    const statuses = new Set(prev.statusCodesSeen || []);
    if (statusCode && cfg.capture.statusCodes) statuses.add(statusCode);

    data.endpoints[key] = {
      schema,
      calls: (prev.calls || 0) + 1,
      firstSeen: prev.firstSeen || now,
      lastSeen: now,
      ...(Object.keys(enumsSerialized).length ? { enumValues: enumsSerialized } : {}),
      ...(queryParams ? { queryParams } : (prev.queryParams ? { queryParams: prev.queryParams } : {})),
      ...(headers ? { responseHeaders: headers } : (prev.responseHeaders ? { responseHeaders: prev.responseHeaders } : {})),
      ...(statuses.size ? { statusCodesSeen: [...statuses].sort() } : {}),
    };

    save();
    logCapture(key, data.endpoints[key].calls);
  }

  // Para WS/SSE: merge de schemas de distintos mensajes
  function recordMerge(key, schema, rawData) {
    const now = new Date().toISOString();
    const prev = data.endpoints[key] || {};
    const merged = prev.schema && typeof prev.schema === 'object' && !Array.isArray(prev.schema)
      ? mergeSchemas(prev.schema, schema) : schema;

    const enumVals = prev.enumValues ? JSON.parse(JSON.stringify(prev.enumValues)) : {};
    for (const k of Object.keys(enumVals)) enumVals[k] = new Set(enumVals[k]);
    if (rawData) collectEnumValues(rawData, enumVals);
    const enumsSerialized = {};
    for (const [k, s] of Object.entries(enumVals)) {
      if (s.size > 0 && s.size <= cfg.maxEnumValues) enumsSerialized[k] = [...s].sort();
    }

    data.endpoints[key] = {
      schema: merged,
      calls: (prev.calls || 0) + 1,
      firstSeen: prev.firstSeen || now,
      lastSeen: now,
      ...(Object.keys(enumsSerialized).length ? { enumValues: enumsSerialized } : {}),
    };
    save();
    logCapture(key, data.endpoints[key].calls);
  }

  // ── GraphQL helpers ───────────────────────────────────────────────────────────
  function isGraphQL(url, body) {
    return cfg.capture.graphql &&
      (url.includes('/graphql') || url.includes('/api/query')) &&
      body && typeof body === 'object' && !Array.isArray(body) && 'query' in body;
  }

  function gqlKey(url, body) { return `GQL ${normalize(url)} [${body.operationName || 'anonymous'}]`; }

  // ── Body parsing ──────────────────────────────────────────────────────────────
  function parseBody(raw) {
    if (!raw || raw instanceof ReadableStream) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return null; }
  }

  // ── Captura HTTP ──────────────────────────────────────────────────────────────
  function captureResponse(method, url, status, contentType, rawBody, reqBody, getHeader) {
    if (!shouldCapture(url)) return;
    if (status < 200 || status >= 300) return;
    if (!contentType || !contentType.includes('application/json')) return;
    const parsedBody = parseBody(rawBody);
    if (!parsedBody) return;

    const schema = extractSchema(parsedBody, 0);
    const qp = extractQueryParams(url);
    const headers = extractRelevantHeaders(getHeader || (() => null));

    if (isGraphQL(url, reqBody)) {
      record(gqlKey(url, reqBody), schema, { queryParams: qp, headers, statusCode: status, rawData: parsedBody });
    } else {
      record(`${method} ${normalize(url)}`, schema, { queryParams: qp, headers, statusCode: status, rawData: parsedBody });
    }
  }

  function captureRequest(method, url, reqBody) {
    if (!cfg.capture.requestBodies) return;
    if (!['POST', 'PUT', 'PATCH'].includes(method)) return;
    if (!shouldCapture(url) || !reqBody || typeof reqBody !== 'object') return;
    if (isGraphQL(url, reqBody)) return;
    record(`REQ ${method} ${normalize(url)}`, extractSchema(reqBody, 0), { rawData: reqBody });
  }

  // ── Stealth helper ────────────────────────────────────────────────────────────
  function stealthSet(obj, prop, patched, original) {
    if (cfg.stealth && original) patched.toString = () => original.toString();
    Object.defineProperty(obj, prop, { value: patched, writable: true, configurable: true });
  }

  // ── Override: fetch ───────────────────────────────────────────────────────────
  if (cfg.capture.fetch) {
    const _fetch = window.fetch;

    async function patchedFetch(...args) {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
      const method = (init.method || (input instanceof Request ? input.method : null) || 'GET').toUpperCase();
      const rawReqBody = init.body ?? (input instanceof Request ? input.body : null);
      const reqBody = parseBody(rawReqBody);

      if (shouldCapture(url) && reqBody) captureRequest(method, url, reqBody);

      const response = await _fetch.apply(this, args);

      if (shouldCapture(url)) {
        const clone = response.clone();
        const ct = clone.headers.get('content-type') || '';
        clone.text().then((body) => {
          captureResponse(method, url, response.status, ct, body, reqBody,
            (h) => response.headers.get(h));
        }).catch(() => {});
      }

      return response;
    }

    stealthSet(window, 'fetch', patchedFetch, _fetch);
  }

  // ── Override: XMLHttpRequest ──────────────────────────────────────────────────
  if (cfg.capture.xhr) {
    const _XHR = window.XMLHttpRequest;

    function PatchedXHR() {
      const xhr = new _XHR();
      let _method = 'GET', _url = '', _reqBody = null;

      const _open = xhr.open;
      xhr.open = function (method, url) {
        _method = (method || 'GET').toUpperCase();
        _url = url || '';
        return _open.apply(xhr, arguments);
      };

      const _send = xhr.send;
      xhr.send = function (body) {
        _reqBody = body;
        const reqBody = parseBody(body);
        if (reqBody) captureRequest(_method, resolve(_url), reqBody);
        return _send.apply(xhr, arguments);
      };

      xhr.addEventListener('load', function () {
        const resolvedUrl = resolve(_url);
        const ct = xhr.getResponseHeader('content-type') || '';
        captureResponse(_method, resolvedUrl, xhr.status, ct, xhr.responseText, parseBody(_reqBody),
          (h) => xhr.getResponseHeader(h));
      });

      return xhr;
    }

    Object.setPrototypeOf(PatchedXHR, _XHR);
    PatchedXHR.prototype = _XHR.prototype;
    if (cfg.stealth) PatchedXHR.toString = () => _XHR.toString();
    Object.defineProperty(window, 'XMLHttpRequest', { value: PatchedXHR, writable: true, configurable: true });
  }

  // ── Override: WebSocket ───────────────────────────────────────────────────────
  if (cfg.capture.websocket) {
    const _WS = window.WebSocket;

    function PatchedWS(url, protocols) {
      const ws = protocols !== undefined ? new _WS(url, protocols) : new _WS(url);
      if (shouldCapture(url)) {
        const key = `WS ${normalize(url)}`;
        ws.addEventListener('message', (e) => {
          if (typeof e.data !== 'string') return;
          const parsed = parseBody(e.data);
          if (parsed) recordMerge(key, extractSchema(parsed, 0), parsed);
        });
      }
      return ws;
    }

    Object.setPrototypeOf(PatchedWS, _WS);
    PatchedWS.prototype = _WS.prototype;
    if (cfg.stealth) PatchedWS.toString = () => _WS.toString();
    Object.defineProperty(window, 'WebSocket', { value: PatchedWS, writable: true, configurable: true });
  }

  // ── Override: EventSource (SSE) ───────────────────────────────────────────────
  if (cfg.capture.sse && typeof window.EventSource !== 'undefined') {
    const _ES = window.EventSource;

    function PatchedES(url, opts) {
      const es = opts !== undefined ? new _ES(url, opts) : new _ES(url);
      if (shouldCapture(url)) {
        const key = `SSE ${normalize(url)}`;
        es.addEventListener('message', (e) => {
          const parsed = parseBody(e.data);
          if (parsed) recordMerge(key, extractSchema(parsed, 0), parsed);
        });
      }
      return es;
    }

    Object.setPrototypeOf(PatchedES, _ES);
    PatchedES.prototype = _ES.prototype;
    if (cfg.stealth) PatchedES.toString = () => _ES.toString();
    Object.defineProperty(window, 'EventSource', { value: PatchedES, writable: true, configurable: true });
  }

  // ── API pública ───────────────────────────────────────────────────────────────
  window.exportSchemas = function () {
    const keys = Object.keys(data.endpoints);
    if (!keys.length) { log('No hay schemas capturados todavía.'); return; }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schemas-${window.location.hostname}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    navigator.clipboard.writeText(json)
      .catch(() => log('No se pudo copiar al clipboard — usá el archivo descargado.'));
    log(`Exportados ${keys.length} endpoints → ${a.download}`);
    return data;
  };

  window.showSchemas = function () {
    const endpoints = data.endpoints;
    const keys = Object.keys(endpoints).sort();
    log(`${keys.length} endpoints capturados:`);
    const groups = { GQL: [], WS: [], SSE: [], REQ: [], HTTP: [] };
    keys.forEach((k) => {
      const e = endpoints[k];
      const enums = e.enumValues ? ` 🏷 [${Object.keys(e.enumValues).join(', ')}]` : '';
      const label = `${k}  [${e.calls}x]${enums}`;
      if (k.startsWith('GQL')) groups.GQL.push(label);
      else if (k.startsWith('WS')) groups.WS.push(label);
      else if (k.startsWith('SSE')) groups.SSE.push(label);
      else if (k.startsWith('REQ')) groups.REQ.push(label);
      else groups.HTTP.push(label);
    });
    Object.entries(groups).forEach(([proto, ks]) => {
      if (ks.length) { console.log(`  ── ${proto} ──`); ks.forEach((k) => console.log('    ', k)); }
    });
    if (data.annotations.length) {
      console.log(`  ── ANOTACIONES (${data.annotations.length}) ──`);
      data.annotations.forEach(({ ts, note }) => console.log(`    [${ts}] ${note}`));
    }
    return data;
  };

  window.annotate = function (note) {
    if (!note) { log('Uso: annotate("tu nota aquí")'); return; }
    const entry = { ts: new Date().toISOString(), note };
    data.annotations.push(entry);
    save();
    log(`Anotación guardada: "${note}"`);
    return entry;
  };

  window.clearSchemas = function () {
    data = { endpoints: {}, annotations: [] };
    localStorage.removeItem(cfg.storageKey);
    log('Schemas borrados. Listo para empezar de cero.');
  };

})(CONFIG);
