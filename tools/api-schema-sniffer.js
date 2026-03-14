/**
 * API Schema Sniffer — DevTools Snippet
 * =======================================
 * Intercepta todo el tráfico de red de una web app y extrae el schema
 * (forma, no valores) de cada respuesta/mensaje JSON.
 *
 * PROTOCOLOS: fetch · XMLHttpRequest · WebSocket · EventSource (SSE) · GraphQL
 *
 * USO RÁPIDO:
 *   1. Sources → Snippets → New Snippet → pegar → Ctrl+S
 *   2. Ejecutar con Ctrl+Enter en la página a capturar
 *   3. Usar la app normalmente
 *   4. exportSchemas()  → descarga JSON + copia al clipboard
 *   5. showSchemas()    → lista endpoints en Console
 *   6. clearSchemas()   → borra todo y empieza de cero
 *   7. Si recarga: re-ejecutar el snippet (carga lo acumulado)
 *
 * CONFIGURAR: editar CONFIG abajo antes de ejecutar
 */

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const CONFIG = {
  // Dominios a capturar. [] = sin filtro (captura todo).
  // Ejemplo: ['pedidosya.com', 'pedidosya.com.ar']
  domains: [],

  // Qué protocolos interceptar
  capture: {
    fetch: true,
    xhr: true,
    websocket: true,
    sse: true,         // Server-Sent Events (EventSource)
    requestBodies: true, // schemas de request body en POST/PUT/PATCH
    graphql: true,     // detecta GraphQL y agrupa por operationName
  },

  // Stealth: hace que los overrides parezcan funciones nativas
  // Previene que la app detecte que fetch/XHR fueron modificados
  stealth: true,

  maxDepth: 5,
  storageKey: 'sniffer_schemas',
};
// ─────────────────────────────────────────────────────────────────────────────

(function run(cfg) {
  // ── Estado ──────────────────────────────────────────────────────────────────
  let schemas = load();
  log(`Iniciado. ${Object.keys(schemas).length} endpoints ya capturados.` +
    (cfg.domains.length ? ` Filtro: [${cfg.domains.join(', ')}]` : ' Sin filtro (captura todo).'));
  log('Comandos: exportSchemas() · showSchemas() · clearSchemas()');

  // ── Helpers de log ──────────────────────────────────────────────────────────
  function log(msg) { console.log(`[Sniffer] ${msg}`); }
  function logCapture(key) { console.log(`[Sniffer] ✓ ${key}`); }

  // ── Persistencia ────────────────────────────────────────────────────────────
  function load() {
    try { return JSON.parse(localStorage.getItem(cfg.storageKey) || '{}'); }
    catch { return {}; }
  }

  function save() {
    localStorage.setItem(cfg.storageKey, JSON.stringify(schemas, null, 2));
  }

  // ── Filtro de dominio ────────────────────────────────────────────────────────
  function shouldCapture(url) {
    if (!cfg.domains.length) return true;
    return cfg.domains.some((d) => url.includes(d));
  }

  // ── Normalización de URL ─────────────────────────────────────────────────────
  function normalize(rawUrl) {
    let url = rawUrl;
    if (!url.startsWith('http')) {
      try { url = new URL(rawUrl, window.location.href).href; }
      catch { return rawUrl; }
    }
    try {
      const u = new URL(url);
      const path = u.pathname
        .replace(/\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi, '/:uuid')
        .replace(/\/\d+/g, '/:id');
      return u.origin + path + (u.search ? '?...' : '');
    } catch {
      return rawUrl.replace(/\/\d+/g, '/:id');
    }
  }

  // ── Extracción de schema recursiva ──────────────────────────────────────────
  function schema(value, depth) {
    if (depth > cfg.maxDepth) return '(max depth)';
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      return value.length === 0 ? [] : [schema(value[0], depth + 1)];
    }
    if (typeof value === 'object') {
      const s = {};
      for (const k of Object.keys(value)) s[k] = schema(value[k], depth + 1);
      return s;
    }
    return typeof value; // 'string' | 'number' | 'boolean'
  }

  // ── Registro central ────────────────────────────────────────────────────────
  function record(key, data) {
    schemas[key] = schema(data, 0);
    save();
    logCapture(key);
  }

  // Para WebSocket: merge de mensajes (mismo canal, distintos tipos de evento)
  function recordWsMerge(key, data) {
    const s = schema(data, 0);
    if (schemas[key] && typeof schemas[key] === 'object' && !Array.isArray(schemas[key])) {
      schemas[key] = Object.assign({}, schemas[key], s);
    } else {
      schemas[key] = s;
    }
    save();
    logCapture(`${key} (merge)`);
  }

  // ── GraphQL ─────────────────────────────────────────────────────────────────
  function isGraphQL(url, bodyData) {
    if (!cfg.capture.graphql) return false;
    return (
      (url.includes('/graphql') || url.includes('/api/query')) &&
      bodyData && typeof bodyData === 'object' && 'query' in bodyData
    );
  }

  function gqlKey(url, bodyData) {
    const op = bodyData.operationName || 'anonymous';
    return `GQL ${normalize(url)} [${op}]`;
  }

  // ── Parseo de body ───────────────────────────────────────────────────────────
  function parseBody(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return null; }
  }

  // ── Captura HTTP (lógica compartida fetch + XHR) ─────────────────────────────
  function captureResponse(method, url, status, contentType, rawBody, reqBodyData) {
    if (!shouldCapture(url)) return;
    if (status < 200 || status >= 300) return;
    if (!contentType || !contentType.includes('application/json')) return;

    const resData = parseBody(rawBody);
    if (resData === null) return;

    if (isGraphQL(url, reqBodyData)) {
      record(gqlKey(url, reqBodyData), resData);
    } else {
      record(`${method} ${normalize(url)}`, resData);
    }
  }

  function captureRequest(method, url, reqBodyData) {
    if (!cfg.capture.requestBodies) return;
    if (!['POST', 'PUT', 'PATCH'].includes(method)) return;
    if (!shouldCapture(url)) return;
    if (!reqBodyData || typeof reqBodyData !== 'object') return;

    if (isGraphQL(url, reqBodyData)) return; // GraphQL vars se capturan en respuesta
    record(`REQ ${method} ${normalize(url)}`, reqBodyData);
  }

  // ── Override: stealth helper ─────────────────────────────────────────────────
  function stealthOverride(obj, prop, patched, original) {
    if (cfg.stealth && original) {
      patched.toString = () => original.toString();
    }
    Object.defineProperty(obj, prop, { value: patched, writable: true, configurable: true });
  }

  // ── Override: fetch ──────────────────────────────────────────────────────────
  if (cfg.capture.fetch) {
    const _fetch = window.fetch;

    async function patchedFetch(...args) {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === 'string' ? input
        : (input instanceof Request ? input.url : String(input));
      // init.method tiene prioridad sobre input.method (según Fetch spec)
      const method = (init.method || (input instanceof Request ? input.method : null) || 'GET').toUpperCase();

      // Capturar request body — leer de init.body o de input (Request object)
      if (shouldCapture(url)) {
        const rawReqBody = init.body ?? (input instanceof Request ? input.body : null);
        const reqBodyData = parseBody(rawReqBody);
        if (reqBodyData) captureRequest(method, url, reqBodyData);
      }

      const response = await _fetch.apply(this, args);

      if (shouldCapture(url)) {
        const clone = response.clone();
        const ct = clone.headers.get('content-type') || '';
        const rawReqBody = init.body ?? (input instanceof Request ? input.body : null);
        const reqBodyData = parseBody(rawReqBody);
        clone.text()
          .then((body) => captureResponse(method, url, response.status, ct, body, reqBodyData))
          .catch(() => {});
      }

      return response;
    }

    stealthOverride(window, 'fetch', patchedFetch, _fetch);
  }

  // ── Override: XMLHttpRequest ─────────────────────────────────────────────────
  if (cfg.capture.xhr) {
    const _XHR = window.XMLHttpRequest;

    function PatchedXHR() {
      const xhr = new _XHR();
      let _method = 'GET';
      let _url = '';
      let _reqBody = null;

      const _open = xhr.open;
      xhr.open = function (method, url) {
        _method = (method || 'GET').toUpperCase();
        _url = url || '';
        return _open.apply(xhr, arguments);
      };

      const _send = xhr.send;
      xhr.send = function (body) {
        _reqBody = body;
        const reqBodyData = parseBody(body);
        if (reqBodyData) {
          const resolved = _url.startsWith('http') ? _url
            : (() => { try { return new URL(_url, window.location.href).href; } catch { return _url; } })();
          captureRequest(_method, resolved, reqBodyData);
        }
        return _send.apply(xhr, arguments);
      };

      xhr.addEventListener('load', function () {
        const resolved = _url.startsWith('http') ? _url
          : (() => { try { return new URL(_url, window.location.href).href; } catch { return _url; } })();
        const ct = xhr.getResponseHeader('content-type') || '';
        const reqBodyData = parseBody(_reqBody);
        captureResponse(_method, resolved, xhr.status, ct, xhr.responseText, reqBodyData);
      });

      return xhr;
    }

    Object.setPrototypeOf(PatchedXHR, _XHR);
    PatchedXHR.prototype = _XHR.prototype;
    if (cfg.stealth) PatchedXHR.toString = () => _XHR.toString();
    Object.defineProperty(window, 'XMLHttpRequest', {
      value: PatchedXHR, writable: true, configurable: true,
    });
  }

  // ── Override: WebSocket ──────────────────────────────────────────────────────
  if (cfg.capture.websocket) {
    const _WS = window.WebSocket;

    function PatchedWS(url, protocols) {
      const ws = protocols !== undefined ? new _WS(url, protocols) : new _WS(url);

      if (shouldCapture(url)) {
        const key = `WS ${normalize(url)}`;
        ws.addEventListener('message', (e) => {
          if (typeof e.data !== 'string') return; // ignorar frames binarios
          const data = parseBody(e.data);
          if (data !== null) recordWsMerge(key, data);
        });
      }

      return ws;
    }

    Object.setPrototypeOf(PatchedWS, _WS);
    PatchedWS.prototype = _WS.prototype;
    if (cfg.stealth) PatchedWS.toString = () => _WS.toString();
    Object.defineProperty(window, 'WebSocket', {
      value: PatchedWS, writable: true, configurable: true,
    });
  }

  // ── Override: EventSource (SSE) ──────────────────────────────────────────────
  if (cfg.capture.sse && typeof window.EventSource !== 'undefined') {
    const _ES = window.EventSource;

    function PatchedES(url, opts) {
      const es = opts !== undefined ? new _ES(url, opts) : new _ES(url);

      if (shouldCapture(url)) {
        const key = `SSE ${normalize(url)}`;
        es.addEventListener('message', (e) => {
          const data = parseBody(e.data);
          if (data !== null) recordWsMerge(key, data);
        });
      }

      return es;
    }

    Object.setPrototypeOf(PatchedES, _ES);
    PatchedES.prototype = _ES.prototype;
    if (cfg.stealth) PatchedES.toString = () => _ES.toString();
    Object.defineProperty(window, 'EventSource', {
      value: PatchedES, writable: true, configurable: true,
    });
  }

  // ── API pública ──────────────────────────────────────────────────────────────
  window.exportSchemas = function () {
    const keys = Object.keys(schemas);
    if (!keys.length) {
      log('No hay schemas capturados todavía. Navegá la app un poco más.');
      return;
    }
    const json = JSON.stringify(schemas, null, 2);

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
    return schemas;
  };

  window.showSchemas = function () {
    const keys = Object.keys(schemas).sort();
    log(`${keys.length} endpoints capturados:`);
    const byProto = { fetch: [], xhr: [], ws: [], sse: [], gql: [], req: [] };
    keys.forEach((k) => {
      if (k.startsWith('GQL')) byProto.gql.push(k);
      else if (k.startsWith('REQ')) byProto.req.push(k);
      else if (k.startsWith('WS')) byProto.ws.push(k);
      else if (k.startsWith('SSE')) byProto.sse.push(k);
      else byProto.fetch.push(k);
    });
    Object.entries(byProto).forEach(([proto, ks]) => {
      if (ks.length) { console.log(`  [${proto.toUpperCase()}]`); ks.forEach((k) => console.log('    ', k)); }
    });
    return schemas;
  };

  window.clearSchemas = function () {
    schemas = {};
    localStorage.removeItem(cfg.storageKey);
    log('Schemas borrados. Listo para empezar de cero.');
  };

})(CONFIG);
