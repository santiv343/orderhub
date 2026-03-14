# Sniffer Extension — Design Doc

_Fecha: 2026-03-14_

## Objetivo

Convertir el DevTools snippet `tools/api-schema-sniffer.js` en una extensión Chrome que:
- Sobrevive recargas de página sin intervención del usuario
- Es configurable desde un popup (dominios, filtros, puerto)
- Escribe schemas en tiempo real a un archivo local (`schemas.json`) vía un servidor Node.js local
- Muestra logs en terminal por cada schema capturado
- Mantiene cola de pendientes si el servidor está caído y flushea cuando vuelve

## Componentes

### 1. `extensions/sniffer/` — Extensión Chrome MV3

**`manifest.json`**
- Permissions: `storage`, `activeTab`, `scripting`, `alarms`
- Background: service worker (`background.js`)
- Content scripts: `content.js` inyectado en `<all_urls>` (on document_start)
- `web_accessible_resources`: `injected.js` con `matches: ["<all_urls>"]` — requerido para que content.ts pueda inyectarlo en el contexto de página via `<script src="chrome-extension://...">`
- Popup: `popup/popup.html`

**`src/injected.ts`**
- Interceptor de red: `window.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` (SSE), detección de GraphQL
- Extrae schema recursivo (tipos, no valores), enum values, query params, request body schema, status codes, hit counter
- Reusar lógica del snippet `tools/api-schema-sniffer.js` casi sin modificaciones
- Lee config desde `window.__SNIFFER_CONFIG__` (inyectada por content.ts antes de este script)
- Comunica capturas via `window.postMessage` con este shape:
  ```ts
  {
    type: 'SNIFFER_CAPTURE',
    payload: {
      endpoint: string,   // "GET https://api.example.com/v1/orders/:id"
      schema: object,     // schema completo del endpoint (igual que en localStorage del snippet)
    }
  }
  ```

**`src/content.ts`**
- Lee config actual desde `chrome.storage.sync`
- Inyecta la config en el contexto de página como script inline (los content scripts viven en un mundo aislado — no pueden asignar a `window` directamente):
  ```ts
  const configScript = document.createElement('script');
  configScript.textContent = `window.__SNIFFER_CONFIG__ = ${JSON.stringify(config)};`;
  document.documentElement.prepend(configScript);
  configScript.remove();
  ```
- Inmediatamente después inyecta `injected.js` via otro `<script src="chrome-extension://...">` tag
- Escucha `window.postMessage` de tipo `SNIFFER_CAPTURE`
- Reenvía a background via `chrome.runtime.sendMessage`

**`src/background.ts`**
- Service worker (MV3)
- Recibe capturas de content scripts via `chrome.runtime.onMessage`
- Mergea el schema recibido en `chrome.storage.local` (fuente de verdad)
- Intenta `POST /schema` al servidor local inmediatamente con payload `{ endpoint: string, schema: object }`
- Si falla: agrega `{ endpoint, schema }` a `pendingQueue` en `chrome.storage.local`
- Para el flush periódico usa `chrome.alarms` (no `setInterval` — los service workers MV3 son killed por Chrome a los ~30s de inactividad): alarm cada 1 minuto que intenta `POST /schemas/batch` con los pendientes y limpia la cola si tiene éxito
- Notifica al popup via `chrome.runtime.sendMessage` para actualizar el contador

**`src/popup/popup.html` + `popup.ts`**
- HTML vanilla (sin framework), TypeScript compilado por Vite como entry point (igual que pedidosya)
- Campos de configuración (persisten en `chrome.storage.sync`):
  - `domains`: array de strings — whitelist (vacío = capturar todo)
  - `ignoreDomains`: array de strings — blacklist (pre-llenado con analytics/tracking)
  - `serverPort`: número — default `7733`
  - `maxDepth`: número — default `5`
  - Todos los protocolos (fetch, XHR, WebSocket, SSE) siempre activos — sin toggles por protocolo (YAGNI)
- Estado en tiempo real:
  - Indicador server online/offline (intenta ping cada 5s)
  - Contador de schemas capturados
  - Contador de items en cola pendiente
- Botón "Export" — descarga schemas desde `chrome.storage.local` como fallback si el server está caído
- Botón "Clear" — borra todo (chrome.storage + queue)

**`build.mjs`**
- Build programático con Vite (mismo patrón que `extensions/pedidosya/build.mjs`)
- Entry points separados: `injected`, `content`, `background`, `popup`
- Output como IIFE (requerido por Chrome MV3 para content scripts)
- `popup.html` se copia plano a `dist/popup.html` (no a `dist/popup/popup.html`) — el `manifest.json` referencia `"default_popup": "popup.html"` desde la raíz de `dist/`

### 2. `tools/sniffer-server.js` — Servidor Node.js local

- Pure Node.js, zero dependencias externas (solo módulos nativos: `http`, `fs`, `path`)
- Puerto configurable via argumento o env var (default `7733`)
- Archivo output configurable via argumento (default `schemas.json` en CWD)

**Endpoints:**
- `POST /schema` — recibe `{ endpoint: string, schema: object }`, mergea en memoria
- `POST /schemas/batch` — recibe `Array<{ endpoint, schema }>`, mergea todos
- `GET /schemas` — devuelve el estado actual en memoria como JSON

**Escritura a archivo:**
- Debounce de 500ms tras cada cambio
- Escritura atómica: `schemas.tmp.json` → rename a `schemas.json`
- Garantiza JSON válido en todo momento (seguro para abrir en VS Code con auto-refresh)

**Logs en terminal:**
```
[12:34:56] ✓ GET /api/:id/recent-orders  (3 campos)
[12:34:57] ✓ POST /api/:id/accept-order  (1 campo)
[12:34:57] 💾 schemas.json  (12 endpoints)
[12:35:00] ⚡ batch flush — 5 pendientes
```

**Al iniciar:** el servidor lee `schemas.json` si existe y carga los schemas previos en memoria, de modo que reinicios del servidor no pierden datos ya capturados.

**Inicio:**
```bash
node tools/sniffer-server.js              # puerto 7733, archivo schemas.json
node tools/sniffer-server.js 8080         # puerto custom
node tools/sniffer-server.js 7733 ./out/schemas.json  # path custom
```

## Flujo de datos

```
Página recarga
  → content.ts ya inyectado (sin re-run manual)
  → inyecta config + injected.js

fetch() interceptado por injected.ts
  → extrae schema
  → window.postMessage({ type: 'SNIFFER_CAPTURE', payload })

content.ts recibe postMessage
  → chrome.runtime.sendMessage al background

background.ts
  → chrome.storage.local: merge schema acumulado
  → intenta POST /schema al server
      OK  → continúa
      ERR → agrega a pendingQueue en chrome.storage.local

background.ts (chrome.alarm cada 1 minuto — mínimo soportado por Chrome)
  → si pendingQueue.length > 0
  → intenta POST /schemas/batch
      OK  → limpia queue
      ERR → deja en queue, reintenta en 1 minuto

sniffer-server.js
  → merge schema en memoria
  → debounce 500ms → escribe schemas.tmp.json → rename schemas.json
  → log en terminal
```

## Estructura de archivos

```
extensions/sniffer/
├── manifest.json
├── build.mjs
├── src/
│   ├── injected.ts
│   ├── content.ts
│   ├── background.ts
│   └── popup/
│       ├── popup.html
│       └── popup.ts
└── dist/              ← generado por build.mjs

tools/
└── sniffer-server.js  ← ya existe el directorio
```

## Decisiones de diseño

- **`chrome.storage.local` como fuente de verdad**: el service worker puede ser killed por Chrome en cualquier momento; tener los schemas en storage garantiza que no se pierde nada
- **Server como sink**: si está caído, los schemas igual se acumulan; la cola es solo para sincronizar el archivo
- **Cola simple (no exponential backoff)**: `chrome.alarms` con periodo de 1 minuto (mínimo que permite Chrome en MV3) — es un dev tool, no necesita sofisticación
- **Zero deps en el server**: el usuario solo necesita `node`, sin `npm install`
- **Popup vanilla**: no vale la pena un framework para 4 campos de config
- **Escritura atómica**: evita JSON corrupto si VS Code tiene el archivo abierto
- **Reusar injected.ts del snippet**: misma lógica de intercepción, sin duplicación
