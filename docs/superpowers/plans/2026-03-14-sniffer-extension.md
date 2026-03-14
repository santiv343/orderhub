# Sniffer Extension Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el DevTools snippet `tools/api-schema-sniffer.js` en una extensión Chrome MV3 + servidor Node.js local que captura schemas en tiempo real, sobrevive recargas de página, es configurable desde un popup, y escribe a `schemas.json` automáticamente.

**Architecture:** La extensión inyecta el interceptor en cada página (sin re-run manual). El background service worker acumula schemas en `chrome.storage.local` y los envía al servidor local. El servidor Node.js (zero deps) recibe los schemas, los mergea en memoria y los escribe a disco con escritura atómica debounceada. Si el server está caído, la extensión mantiene una cola en `chrome.storage.local` y flushea cuando el server vuelve (via `chrome.alarms` cada 1 minuto).

**Tech Stack:** Chrome Extension MV3, TypeScript, Vite (build), Node.js puro (server), `chrome.storage`, `chrome.alarms`.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `tools/sniffer-server.js` | Crear | Servidor HTTP Node.js: recibe schemas, escribe JSON a disco |
| `extensions/sniffer/manifest.json` | Crear | Declaración MV3, permisos, content scripts |
| `extensions/sniffer/package.json` | Crear | Dependencias dev (Vite, TypeScript, @types/chrome) |
| `extensions/sniffer/tsconfig.json` | Crear | Config TypeScript |
| `extensions/sniffer/build.mjs` | Crear | Build script Vite (mismo patrón que pedidosya) |
| `extensions/sniffer/src/injected.ts` | Crear | Interceptor de red (adaptado del snippet) — corre en contexto de página |
| `extensions/sniffer/src/content.ts` | Crear | Inyecta config + injected.js, relay de mensajes |
| `extensions/sniffer/src/background.ts` | Crear | Service worker: mergea en storage, envía a server, cola con alarms |
| `extensions/sniffer/src/popup/popup.html` | Crear | UI del popup (HTML vanilla) |
| `extensions/sniffer/src/popup/popup.ts` | Crear | Lógica del popup: config, estado, export, clear |

---

## Chunk 1: Servidor Node.js

### Task 1: `tools/sniffer-server.js`

**Files:**
- Create: `tools/sniffer-server.js`

> El servidor es pure Node.js (sin deps). Levanta un HTTP server en localhost:7733, recibe schemas de la extensión, los mergea en memoria, y los escribe a `schemas.json` con debounce de 500ms y escritura atómica. Al iniciar, carga el archivo existente si hay uno.

- [ ] **Step 1: Crear `tools/sniffer-server.js`**

```javascript
#!/usr/bin/env node
/**
 * Sniffer Server — recibe schemas de la extensión Chrome y los escribe a disco
 *
 * Uso:
 *   node tools/sniffer-server.js              # puerto 7733, schemas.json en CWD
 *   node tools/sniffer-server.js 8080         # puerto custom
 *   node tools/sniffer-server.js 7733 ./out/schemas.json
 */
import { createServer } from 'http';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { resolve } from 'path';

const PORT = parseInt(process.argv[2] ?? '7733', 10);
const OUT_FILE = resolve(process.argv[3] ?? 'schemas.json');
const TMP_FILE = OUT_FILE + '.tmp';

// ── Estado ─────────────────────────────────────────────────────────────────────

// Carga schemas existentes al iniciar (reinicios del server no pierden datos)
let schemas = {};
if (existsSync(OUT_FILE)) {
  try {
    schemas = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
    log(`Cargados ${Object.keys(schemas).length} endpoints desde ${OUT_FILE}`);
  } catch {
    log(`Aviso: no se pudo parsear ${OUT_FILE}, empezando de cero`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-AR', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function fieldCount(schema) {
  if (!schema || typeof schema !== 'object') return 0;
  return Object.keys(schema).length;
}

// ── Escritura debounceada + atómica ───────────────────────────────────────────

let writeTimer = null;

function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const json = JSON.stringify(schemas, null, 2);
    writeFileSync(TMP_FILE, json, 'utf8');
    renameSync(TMP_FILE, OUT_FILE);
    log(`💾 ${OUT_FILE}  (${Object.keys(schemas).length} endpoints)`);
    writeTimer = null;
  }, 500);
}

// ── Merge ─────────────────────────────────────────────────────────────────────

function mergeOne(endpoint, schema) {
  // Last write wins — la extensión ya hizo el merge/acumulación en memoria
  schemas[endpoint] = schema;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function respond(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // POST /schema — schema individual
  if (req.method === 'POST' && req.url === '/schema') {
    try {
      const { endpoint, schema } = await readBody(req);
      if (!endpoint || schema === undefined) {
        respond(res, 400, { error: 'endpoint and schema required' });
        return;
      }
      mergeOne(endpoint, schema);
      scheduleWrite();
      log(`✓ ${endpoint}  (${fieldCount(schema)} campos)`);
      respond(res, 200, { ok: true });
    } catch {
      respond(res, 400, { error: 'invalid JSON' });
    }
    return;
  }

  // POST /schemas/batch — flush de cola
  if (req.method === 'POST' && req.url === '/schemas/batch') {
    try {
      const items = await readBody(req);
      if (!Array.isArray(items)) {
        respond(res, 400, { error: 'expected array' });
        return;
      }
      items.forEach(({ endpoint, schema }) => { if (endpoint) mergeOne(endpoint, schema); });
      scheduleWrite();
      log(`⚡ batch flush — ${items.length} pendientes`);
      respond(res, 200, { ok: true, count: items.length });
    } catch {
      respond(res, 400, { error: 'invalid JSON' });
    }
    return;
  }

  // GET /schemas — estado actual
  if (req.method === 'GET' && req.url === '/schemas') {
    respond(res, 200, schemas);
    return;
  }

  // GET /ping — health check para el popup
  if (req.method === 'GET' && req.url === '/ping') {
    respond(res, 200, { ok: true, endpoints: Object.keys(schemas).length });
    return;
  }

  respond(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Sniffer Server escuchando en http://127.0.0.1:${PORT}`);
  log(`Escribiendo en: ${OUT_FILE}`);
  log('Endpoints: POST /schema  ·  POST /schemas/batch  ·  GET /schemas  ·  GET /ping');
});
```

- [ ] **Step 2: Verificar que arranca**

```bash
node tools/sniffer-server.js
```

Expected:
```
[HH:MM:SS] Sniffer Server escuchando en http://127.0.0.1:7733
[HH:MM:SS] Escribiendo en: C:\...\schemas.json
[HH:MM:SS] Endpoints: POST /schema  ·  POST /schemas/batch  ·  GET /schemas  ·  GET /ping
```

- [ ] **Step 3: Verificar /ping**

```bash
curl http://127.0.0.1:7733/ping
```

Expected: `{"ok":true,"endpoints":0}`

- [ ] **Step 4: Verificar POST /schema y escritura a disco**

```bash
curl -X POST http://127.0.0.1:7733/schema \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"GET https://api.example.com/v1/orders/:id","schema":{"id":"number","status":"string"}}'
```

Expected en terminal: `[HH:MM:SS] ✓ GET https://api.example.com/v1/orders/:id  (2 campos)`

Después de 500ms, verificar que existe `schemas.json` en el directorio:
```bash
cat schemas.json
```

Expected: JSON con el endpoint capturado.

- [ ] **Step 5: Verificar batch**

```bash
curl -X POST http://127.0.0.1:7733/schemas/batch \
  -H "Content-Type: application/json" \
  -d '[{"endpoint":"POST https://api.example.com/v1/orders","schema":{"total":"number"}},{"endpoint":"GET https://api.example.com/v1/menu","schema":{"items":"array"}}]'
```

Expected: `{"ok":true,"count":2}` y log `⚡ batch flush — 2 pendientes`

- [ ] **Step 6: Verificar carga al reiniciar**

Parar el server (Ctrl+C) y reiniciarlo:
```bash
node tools/sniffer-server.js
```

Expected: `[HH:MM:SS] Cargados 3 endpoints desde schemas.json`

- [ ] **Step 7: Commit**

```bash
git add tools/sniffer-server.js
git commit -m "feat: servidor Node.js para recibir schemas de extensión Chrome en tiempo real"
```

---

## Chunk 2: Scaffold de la extensión

### Task 2: Archivos de configuración de la extensión

**Files:**
- Create: `extensions/sniffer/package.json`
- Create: `extensions/sniffer/tsconfig.json`
- Create: `extensions/sniffer/manifest.json`
- Create: `extensions/sniffer/build.mjs`

- [ ] **Step 1: Crear `extensions/sniffer/package.json`**

```json
{
  "name": "@orderhub/extension-sniffer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "node build.mjs"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 2: Crear `extensions/sniffer/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["chrome"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear `extensions/sniffer/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "API Schema Sniffer",
  "version": "0.1.0",
  "description": "Captura schemas de APIs en tiempo real y los escribe a schemas.json via servidor local",
  "permissions": ["storage", "alarms"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "API Schema Sniffer"
  },
  "web_accessible_resources": [
    {
      "resources": ["injected.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 4: Crear `extensions/sniffer/build.mjs`**

Mismo patrón que `extensions/pedidosya/build.mjs`:

```javascript
/**
 * Build script para la extensión Sniffer.
 * Vite/Rollup no soporta IIFE con múltiples entry points — construimos cada uno por separado.
 */
import { build } from 'vite';
import { resolve, dirname } from 'path';
import { copyFileSync, rmSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'dist');

const sharedConfig = {
  build: {
    outDir: OUT_DIR,
    emptyOutDir: false,
    minify: false,
  },
};

const entries = [
  { name: 'injected',   input: resolve(__dirname, 'src/injected.ts') },
  { name: 'content',    input: resolve(__dirname, 'src/content.ts') },
  { name: 'background', input: resolve(__dirname, 'src/background.ts') },
  { name: 'popup',      input: resolve(__dirname, 'src/popup/popup.ts') },
];

// Limpiar dist/ una vez antes de todos los builds
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const entry of entries) {
  await build({
    ...sharedConfig,
    build: {
      ...sharedConfig.build,
      rollupOptions: {
        input: entry.input,
        output: {
          entryFileNames: `${entry.name}.js`,
          format: 'iife',    // self-contained, requerido por Chrome MV3
          name: entry.name,
        },
      },
    },
  });
}

// Copiar assets estáticos
copyFileSync(resolve(__dirname, 'manifest.json'), resolve(OUT_DIR, 'manifest.json'));
// popup.html va PLANO en dist/ (no en dist/popup/) — el manifest lo referencia como "popup.html"
copyFileSync(resolve(__dirname, 'src/popup/popup.html'), resolve(OUT_DIR, 'popup.html'));

console.log('\n✓ Extension built successfully → dist/');
```

- [ ] **Step 5: Instalar dependencias**

```bash
cd extensions/sniffer
pnpm install
```

Expected: instala Vite, TypeScript, @types/chrome en `extensions/sniffer/node_modules/`

- [ ] **Step 6: Commit**

```bash
git add extensions/sniffer/package.json extensions/sniffer/tsconfig.json extensions/sniffer/manifest.json extensions/sniffer/build.mjs
git commit -m "feat: scaffold extensión Sniffer — MV3, Vite, TypeScript"
```

---

## Chunk 3: Interceptor (`injected.ts`)

### Task 3: `extensions/sniffer/src/injected.ts`

**Files:**
- Create: `extensions/sniffer/src/injected.ts`

> Adaptación del snippet `tools/api-schema-sniffer.js` para correr como extensión Chrome. Cambios clave:
> - Lee config desde `window.__SNIFFER_CONFIG__` (inyectada por content.ts) con fallback a defaults
> - En lugar de `save()` a localStorage, llama `emit(endpoint, schema)` via `window.postMessage`
> - Mantiene estado en memoria por sesión de página (sin localStorage)
> - Sin funciones públicas (`exportSchemas`, etc.) — esas están en el popup
> - TypeScript types

- [ ] **Step 1: Crear estructura de directorios**

```bash
mkdir -p extensions/sniffer/src/popup
```

- [ ] **Step 2: Crear `extensions/sniffer/src/injected.ts`**

```typescript
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
```

- [ ] **Step 3: Verificar que TypeScript no tiene errores de tipo**

```bash
cd extensions/sniffer && npx tsc --noEmit
```

Expected: sin errores (puede haber warnings menores de `unknown` en los XHR overrides — son aceptables).

- [ ] **Step 4: Commit**

```bash
git add extensions/sniffer/src/injected.ts
git commit -m "feat: injected.ts — interceptor de red adaptado del snippet para extensión Chrome"
```

---

## Chunk 4: Content script y Background service worker

### Task 4: `extensions/sniffer/src/content.ts`

**Files:**
- Create: `extensions/sniffer/src/content.ts`

- [ ] **Step 1: Crear `extensions/sniffer/src/content.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add extensions/sniffer/src/content.ts
git commit -m "feat: content.ts — inyecta config + interceptor, relay de capturas al background"
```

---

### Task 5: `extensions/sniffer/src/background.ts`

**Files:**
- Create: `extensions/sniffer/src/background.ts`

- [ ] **Step 1: Crear `extensions/sniffer/src/background.ts`**

```typescript
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

function getPort(): Promise<number> {
  return new Promise((resolve) =>
    chrome.storage.sync.get({ serverPort: 7733 }, (c) => resolve(c['serverPort'] as number)),
  );
}

function getSchemas(): Promise<Record<string, unknown>> {
  return new Promise((resolve) =>
    chrome.storage.local.get({ schemas: {} }, (c) => resolve(c['schemas'] as Record<string, unknown>)),
  );
}

function saveSchemas(schemas: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.set({ schemas }, resolve));
}

function getQueue(): Promise<SchemaCapture[]> {
  return new Promise((resolve) =>
    chrome.storage.local.get({ queue: [] }, (c) => resolve(c['queue'] as SchemaCapture[])),
  );
}

function saveQueue(queue: SchemaCapture[]): Promise<void> {
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

chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });

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
```

- [ ] **Step 2: Commit**

```bash
git add extensions/sniffer/src/background.ts
git commit -m "feat: background.ts — service worker con cola offline y flush via chrome.alarms"
```

---

## Chunk 5: Popup

### Task 6: `extensions/sniffer/src/popup/`

**Files:**
- Create: `extensions/sniffer/src/popup/popup.html`
- Create: `extensions/sniffer/src/popup/popup.ts`

- [ ] **Step 1: Crear `extensions/sniffer/src/popup/popup.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>API Schema Sniffer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      width: 340px;
      padding: 16px;
      background: #0f172a;
      color: #f1f5f9;
    }
    h1 { font-size: 15px; font-weight: 600; margin-bottom: 14px; color: #38bdf8; }
    .status-row {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 10px; font-size: 13px;
    }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #64748b; flex-shrink: 0;
    }
    .dot.connected { background: #22c55e; }
    .dot.error { background: #ef4444; }
    .stats {
      display: flex; gap: 16px; margin-bottom: 14px;
      font-size: 12px; color: #94a3b8;
    }
    .stat strong { color: #f1f5f9; font-size: 18px; display: block; }
    .section { margin-top: 14px; padding-top: 14px; border-top: 1px solid #1e293b; }
    label { display: block; font-size: 11px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
    input, textarea {
      width: 100%; padding: 6px 8px;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 5px; color: #f1f5f9;
      font-size: 12px; outline: none; resize: vertical;
    }
    input:focus, textarea:focus { border-color: #38bdf8; }
    .row { display: flex; gap: 8px; }
    .row > * { flex: 1; }
    button {
      width: 100%; margin-top: 8px; padding: 7px;
      background: #0284c7; color: #fff;
      border: none; border-radius: 5px;
      font-size: 12px; font-weight: 500; cursor: pointer;
    }
    button:hover { background: #0369a1; }
    button.secondary { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    button.secondary:hover { background: #334155; }
    button.danger { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    button.danger:hover { background: #991b1b; }
    .btn-row { display: flex; gap: 6px; margin-top: 8px; }
    .btn-row button { margin-top: 0; }
    #saved-msg { font-size: 11px; color: #22c55e; margin-top: 5px; display: none; }
    .hint { font-size: 11px; color: #475569; margin-top: 3px; }
  </style>
</head>
<body>
  <h1>API Schema Sniffer</h1>

  <div class="status-row">
    <span class="dot" id="dot"></span>
    <span id="status-text">Verificando...</span>
  </div>

  <div class="stats">
    <div class="stat"><strong id="schema-count">—</strong>endpoints</div>
    <div class="stat"><strong id="queue-count">—</strong>en cola</div>
  </div>

  <div class="section">
    <label>Dominios a capturar (uno por línea, vacío = todo)</label>
    <textarea id="domains" rows="2" placeholder="pedidosya.com&#10;pedidosya.com.ar"></textarea>

    <label style="margin-top:8px">Dominios ignorados (uno por línea)</label>
    <textarea id="ignore-domains" rows="3"></textarea>

    <div class="row" style="margin-top:8px">
      <div>
        <label>Puerto del server</label>
        <input type="number" id="server-port" value="7733" />
      </div>
      <div>
        <label>Max depth</label>
        <input type="number" id="max-depth" value="5" />
      </div>
    </div>

    <button id="save-btn">Guardar configuración</button>
    <div id="saved-msg">✓ Guardado — recargá la página para aplicar</div>
  </div>

  <div class="section">
    <div class="btn-row">
      <button class="secondary" id="export-btn">Exportar JSON</button>
      <button class="danger" id="clear-btn">Limpiar todo</button>
    </div>
    <div class="hint">Exportar descarga schemas.json desde chrome.storage (fallback si el server está offline).</div>
  </div>

  <!-- IIFE format — sin type="module" -->
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear `extensions/sniffer/src/popup/popup.ts`**

```typescript
const DEFAULT_IGNORE_DOMAINS = [
  'google-analytics', 'googletagmanager', 'googlesyndication', 'doubleclick',
  'facebook.net', 'fbcdn.net', 'segment.io', 'sentry.io', 'hotjar.com',
  'intercom.io', 'mixpanel.com', 'amplitude.com', 'newrelic.com',
  'rollbar.com', 'logrocket.com', 'fullstory.com', 'datadoghq.com',
].join('\n');

async function init(): Promise<void> {
  // ── Cargar estado inicial ───────────────────────────────────────────────────
  const stored = await new Promise<Record<string, unknown>>((resolve) =>
    chrome.storage.sync.get(
      { domains: [], ignoreDomains: DEFAULT_IGNORE_DOMAINS.split('\n'), serverPort: 7733, maxDepth: 5 },
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
```

- [ ] **Step 3: Commit**

```bash
git add extensions/sniffer/src/popup/
git commit -m "feat: popup — config UI, estado server, export y clear"
```

---

## Chunk 6: Build y verificación final

### Task 7: Build y prueba en Chrome

**Files:** (ninguno nuevo — verificación)

- [ ] **Step 1: Hacer el build**

```bash
cd extensions/sniffer && node build.mjs
```

Expected:
```
✓ Extension built successfully → dist/
```

Verificar que existen en `extensions/sniffer/dist/`:
```
dist/
├── injected.js
├── content.js
├── background.js
├── popup.js
├── popup.html
└── manifest.json
```

- [ ] **Step 2: Cargar la extensión en Chrome**

1. Abrir Chrome → `chrome://extensions`
2. Activar **Developer mode** (toggle arriba a la derecha)
3. Click **Load unpacked**
4. Seleccionar `extensions/sniffer/dist/`

Expected: la extensión aparece listada como "API Schema Sniffer".

- [ ] **Step 3: Iniciar el servidor**

En una terminal aparte:
```bash
node tools/sniffer-server.js
```

Expected:
```
[HH:MM:SS] Sniffer Server escuchando en http://127.0.0.1:7733
[HH:MM:SS] Escribiendo en: C:\...\schemas.json
```

- [ ] **Step 4: Verificar popup**

Click en el ícono de la extensión → debe abrir el popup.

Expected:
- Dot verde: "Server online · 0 endpoints en disco"
- Campos de config poblados con defaults
- Stats: "0 endpoints, 0 en cola"

- [ ] **Step 5: Verificar captura en una web app**

Abrir cualquier página que haga requests (ej: `https://jsonplaceholder.typicode.com` o el panel de PedidosYa).

En la Console de DevTools deben aparecer:
```
[Sniffer] Interceptor activo — capturando todo
[Sniffer] ✓ GET https://jsonplaceholder.typicode.com/posts/:id  (1x)
```

Y en la terminal del servidor:
```
[HH:MM:SS] ✓ GET https://jsonplaceholder.typicode.com/posts/:id  (8 campos)
[HH:MM:SS] 💾 schemas.json  (1 endpoints)
```

- [ ] **Step 6: Verificar que sobrevive recargas**

Recargar la página (F5). Expected: el interceptor sigue activo inmediatamente sin hacer nada. Los schemas se siguen acumulando (el contador en el popup sube).

- [ ] **Step 7: Verificar cola offline**

1. Parar el servidor (Ctrl+C en la terminal)
2. Navegar la página — en DevTools sigue apareciendo `[Sniffer] ✓ ...`
3. El popup debe mostrar "Server offline" y el contador de "en cola" subir
4. Reiniciar el servidor: `node tools/sniffer-server.js`
5. Esperar hasta 1 minuto (alarm) o navegar para disparar capturas
6. Expected: el servidor loguea `⚡ batch flush — N pendientes` y el queue vuelve a 0

- [ ] **Step 8: Verificar filtro de dominios**

En el popup, agregar `jsonplaceholder.typicode.com` en "Dominios a capturar" → Guardar.
Recargar la página.
Expected en Console: `[Sniffer] Interceptor activo — filtrando: [jsonplaceholder.typicode.com]`

Navegar a otra URL distinta → no deben aparecer capturas.

- [ ] **Step 9: Commit final**

```bash
git add -A
git commit -m "feat: extensión Chrome Sniffer completa — MV3, cola offline, popup config, servidor Node.js"
```

---

## Uso rápido (resumen)

```bash
# 1. Build de la extensión (solo cuando hay cambios en src/)
cd extensions/sniffer && node build.mjs

# 2. Iniciar el servidor (una vez, dejar corriendo)
node tools/sniffer-server.js

# 3. En Chrome: cargar extensions/sniffer/dist/ como extensión desempaquetada
# (solo la primera vez — Chrome recarga automáticamente al cambiar dist/)

# 4. Navegar la app que querés capturar
# Los schemas aparecen en terminal y en schemas.json en tiempo real

# 5. Para PedidosYa específicamente, configurar en el popup:
# Dominios: pedidosya.com
#            pedidosya.com.ar
```
