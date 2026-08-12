# API Schema Sniffer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un script JS para ejecutar como Chrome DevTools Snippet que intercepta todos los requests de cualquier web app (fetch, XHR, WebSocket), extrae el schema recursivo de cada respuesta JSON, persiste en localStorage, y permite exportar con `exportSchemas()`.

**Architecture:** IIFE auto-contenida con un objeto `CONFIG` editable al inicio (dominio/s a filtrar — vacío captura todo). Overridea `window.fetch`, `XMLHttpRequest` y `WebSocket`. Extrae schemas (tipos, no valores), normaliza URLs, persiste en `localStorage['sniffer_schemas']` tras cada captura. Al re-ejecutarse, carga lo acumulado y continúa.

**Tech Stack:** Vanilla JavaScript (sin dependencias), Chrome DevTools Snippets, localStorage, Blob API.

---

## Chunk 1: Script completo

### Task 1: Crear `tools/api-schema-sniffer.js`

**Files:**
- Create: `tools/api-schema-sniffer.js`

- [ ] **Step 1: Crear el directorio `tools/` y el archivo**

Crear `tools/api-schema-sniffer.js` con el siguiente contenido:

```javascript
/**
 * API Schema Sniffer — DevTools Snippet
 * =======================================
 * Captura el schema (forma, no valores) de todas las respuestas JSON
 * de una web app. Funciona con fetch, XMLHttpRequest y WebSocket.
 *
 * USO:
 *   1. Editar CONFIG abajo (opcional — vacío captura todo)
 *   2. Sources → Snippets → New Snippet → pegar → guardar
 *   3. Abrir la web app a capturar, ejecutar con Ctrl+Enter
 *   4. Usar la app normalmente
 *   5. exportSchemas() → descarga schemas.json + copia al clipboard
 *   6. Si la página recarga: re-ejecutar el snippet (carga lo acumulado)
 *   7. clearSchemas() → borra todo y empieza de cero
 *   8. showSchemas() → lista endpoints capturados en Console
 */

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const CONFIG = {
  // Dominios a capturar. Vacío [] = capturar todos los requests (sin filtro).
  // Ejemplos: ['pedidosya.com', 'pedidosya.com.ar'] o ['myapp.io']
  domains: [],

  // Profundidad máxima de anidamiento en el schema
  maxDepth: 5,

  // Clave en localStorage donde se guardan los schemas
  storageKey: 'sniffer_schemas',
};
// ─────────────────────────────────────────────────────────────────────────────

(function (cfg) {
  // --- Estado ---
  let schemas = loadSchemas();
  console.log(
    `[Sniffer] Iniciado. ${Object.keys(schemas).length} endpoints ya capturados.` +
    (cfg.domains.length ? ` Filtrando: ${cfg.domains.join(', ')}` : ' Sin filtro de dominio (captura todo).') +
    '\nComandos: exportSchemas() · showSchemas() · clearSchemas()',
  );

  // --- Persistencia ---
  function loadSchemas() {
    try { return JSON.parse(localStorage.getItem(cfg.storageKey) || '{}'); }
    catch { return {}; }
  }

  function saveSchemas() {
    localStorage.setItem(cfg.storageKey, JSON.stringify(schemas, null, 2));
  }

  // --- Filtro de dominio ---
  function shouldCapture(url) {
    if (cfg.domains.length === 0) return true;
    return cfg.domains.some((d) => url.includes(d));
  }

  // --- Normalización de URL ---
  function normalizeUrl(rawUrl) {
    let url = rawUrl;
    // Resolver URLs relativas contra la página actual
    if (!url.startsWith('http')) {
      try { url = new URL(rawUrl, window.location.href).href; }
      catch { return rawUrl; }
    }
    try {
      const u = new URL(url);
      const path = u.pathname
        // UUIDs primero (antes de numéricos para no cortar a la mitad)
        .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:uuid')
        // IDs numéricos
        .replace(/\/\d+/g, '/:id');
      return u.origin + path + (u.search ? '?...' : '');
    } catch {
      return rawUrl.replace(/\/\d+/g, '/:id');
    }
  }

  // --- Extracción de schema recursiva ---
  function extractSchema(value, depth) {
    if (depth > cfg.maxDepth) return '(max depth)';
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      // Usa el primer elemento como representativo del shape del array
      return [extractSchema(value[0], depth + 1)];
    }
    if (typeof value === 'object') {
      const schema = {};
      for (const key of Object.keys(value)) {
        schema[key] = extractSchema(value[key], depth + 1);
      }
      return schema;
    }
    return typeof value; // 'string', 'number', 'boolean'
  }

  // --- Registro central ---
  function record(method, url, schema) {
    const key = `${method} ${normalizeUrl(url)}`;
    schemas[key] = schema;
    saveSchemas();
    console.log(`[Sniffer] ✓ ${key}`);
  }

  // --- Captura HTTP (fetch y XHR) ---
  function captureHttp(method, url, status, contentType, rawBody) {
    if (!shouldCapture(url)) return;
    if (status < 200 || status >= 300) return;
    if (!contentType || !contentType.includes('application/json')) return;

    let data;
    try { data = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody; }
    catch { return; }

    record(method, url, extractSchema(data, 0));
  }

  // --- Override fetch ---
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const input = args[0];
    const url = typeof input === 'string' ? input
      : (input instanceof Request ? input.url : String(input));
    const method = ((input instanceof Request ? input.method : null)
      || args[1]?.method || 'GET').toUpperCase();

    const response = await _fetch.apply(this, args);

    if (shouldCapture(url)) {
      const clone = response.clone();
      const contentType = clone.headers.get('content-type') || '';
      clone.text()
        .then((body) => captureHttp(method, url, response.status, contentType, body))
        .catch(() => {});
    }

    return response;
  };

  // --- Override XMLHttpRequest ---
  const _XHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new _XHR();
    let _method = 'GET';
    let _url = '';

    const _open = xhr.open;
    xhr.open = function (method, url) {
      _method = (method || 'GET').toUpperCase();
      _url = url || '';
      return _open.apply(xhr, arguments); // pasa todos los args (async, user, pass)
    };

    xhr.addEventListener('load', function () {
      // Resolver URL relativa antes de capturar
      const resolvedUrl = _url.startsWith('http') ? _url
        : (() => { try { return new URL(_url, window.location.href).href; } catch { return _url; } })();
      captureHttp(_method, resolvedUrl, xhr.status,
        xhr.getResponseHeader('content-type') || '', xhr.responseText);
    });

    return xhr; // retornar la instancia original patcheada
  }
  // Heredar constantes estáticas (DONE=4, OPENED=1, etc.) y prototype
  Object.setPrototypeOf(PatchedXHR, _XHR);
  PatchedXHR.prototype = _XHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // --- Override WebSocket ---
  const _WS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new _WS(url, protocols) : new _WS(url);
    const wsKey = `WS ${normalizeUrl(url)}`;

    if (shouldCapture(url)) {
      const _onmessage = Object.getOwnPropertyDescriptor(_WS.prototype, 'onmessage');
      ws.addEventListener('message', function (event) {
        const data = event.data;
        if (typeof data !== 'string') return; // ignorar binary frames
        let parsed;
        try { parsed = JSON.parse(data); } catch { return; }

        // Para WebSocket acumulamos el schema — puede llegar más de un tipo de mensaje
        // Si ya existe el key, hacemos merge superficial de campos nuevos
        const newSchema = extractSchema(parsed, 0);
        if (schemas[wsKey] && typeof schemas[wsKey] === 'object' && !Array.isArray(schemas[wsKey])) {
          schemas[wsKey] = Object.assign({}, schemas[wsKey], newSchema);
        } else {
          schemas[wsKey] = newSchema;
        }
        saveSchemas();
        console.log(`[Sniffer] ✓ ${wsKey} (WS message)`);
      });
    }

    return ws;
  };
  Object.setPrototypeOf(window.WebSocket, _WS);
  window.WebSocket.prototype = _WS.prototype;

  // --- API pública ---
  window.exportSchemas = function () {
    const count = Object.keys(schemas).length;
    if (count === 0) {
      console.warn('[Sniffer] No hay schemas capturados todavía. Navegá la app un poco más.');
      return;
    }
    const json = JSON.stringify(schemas, null, 2);

    // Descargar archivo
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schemas-${window.location.hostname}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revocar después de que el browser haya iniciado la descarga
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);

    navigator.clipboard.writeText(json).catch(() => {
      console.warn('[Sniffer] No se pudo copiar al clipboard. Usá el archivo descargado.');
    });

    console.log(`[Sniffer] Exportados ${count} endpoints → schemas-${window.location.hostname}-*.json`);
    return schemas;
  };

  window.clearSchemas = function () {
    schemas = {};
    localStorage.removeItem(cfg.storageKey);
    console.log('[Sniffer] Schemas borrados. Listo para capturar de cero.');
  };

  window.showSchemas = function () {
    const keys = Object.keys(schemas).sort();
    console.log(`[Sniffer] ${keys.length} endpoints capturados:`);
    keys.forEach((k) => console.log('  ', k));
    return schemas;
  };

})(CONFIG);
```

- [ ] **Step 2: Verificar que el archivo existe**

```bash
ls -la tools/api-schema-sniffer.js
```

Expected: archivo existe (~180 líneas)

- [ ] **Step 3: Commit**

```bash
git add tools/api-schema-sniffer.js
git commit -m "feat: DevTools snippet generalizado para capturar schemas de cualquier web app (fetch, XHR, WebSocket)"
```

---

### Task 2: Verificación manual en browser

- [ ] **Step 1: Cargar en DevTools**

1. Abrir cualquier web app con DevTools (F12)
2. **Sources → Snippets** (panel izquierdo, puede requerir `>>`) → **+ New Snippet**
3. Pegar el contenido de `tools/api-schema-sniffer.js`
4. Guardar con `Ctrl+S` → ejecutar con `Ctrl+Enter`

Expected en Console:
```
[Sniffer] Iniciado. 0 endpoints ya capturados. Sin filtro de dominio (captura todo).
Comandos: exportSchemas() · showSchemas() · clearSchemas()
```

- [ ] **Step 2: Con filtro de dominio (modo PedidosYa)**

Para usar solo con PedidosYa, editar el CONFIG antes de ejecutar:
```javascript
const CONFIG = {
  domains: ['pedidosya.com', 'pedidosya.com.ar'],
  ...
};
```

Expected en Console al ejecutar:
```
[Sniffer] Iniciado. 0 endpoints ya capturados. Filtrando: pedidosya.com, pedidosya.com.ar
```

- [ ] **Step 3: Verificar captura de fetch**

Navegar la app. Expected: aparecen líneas como:
```
[Sniffer] ✓ GET https://api.example.com/v2/orders/:id
```

Si no aparece nada con filtro de dominio: verificar en **Network tab → Fetch/XHR** qué dominios usa realmente la app y ajustar `CONFIG.domains`.

- [ ] **Step 4: Verificar captura de WebSocket (si aplica)**

Si la app usa WebSockets: Expected en Console cuando llega un mensaje:
```
[Sniffer] ✓ WS wss://ws.example.com/realtime (WS message)
```

- [ ] **Step 5: Verificar persistencia**

```javascript
localStorage.getItem('sniffer_schemas') // → JSON con schemas capturados
```

Recargar la página, re-ejecutar el snippet. Expected:
```
[Sniffer] Iniciado. N endpoints ya capturados.
```

- [ ] **Step 6: Exportar**

```javascript
exportSchemas()
// → descarga schemas-<hostname>-YYYY-MM-DD.json
// → copia al clipboard
```

---

## Output esperado para compartir con el agente

```json
{
  "GET https://api.pedidosya.com/v2/orders/:id": {
    "id": "number",
    "status": "string",
    "total": "number",
    "customer": { "name": "string", "phone": "string" },
    "items": [{ "name": "string", "quantity": "number", "unitPrice": "number" }]
  },
  "WS wss://ws.pedidosya.com/merchant": {
    "type": "string",
    "payload": { "orderId": "number", "status": "string" }
  }
}
```

Pegar ese JSON en el chat para que el agente actualice `parser.ts` y `extension.types.ts`.

---

## Notas de diseño

- **`domains: []`** = sin filtro → captura absolutamente todo (fetch, XHR, WS) desde cualquier dominio. Útil para exploración inicial antes de saber qué dominios usa la app.
- **WebSocket merge**: para WS se acumulan campos de múltiples mensajes (merge superficial) porque un mismo canal puede mandar distintos tipos de mensajes.
- **Arrays**: el schema usa el primer elemento como representativo. Si el primer elemento no es representativo del shape real, el usuario puede llamar `showSchemas()` y ver si hay variaciones.
- **Server-Sent Events (SSE)**: no cubiertos en esta versión — si la app usa SSE y lo necesitamos, se puede agregar un override de `EventSource` con el mismo patrón.
