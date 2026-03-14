# Orderhub — Contexto de Sesión

_Última actualización: 2026-03-14_

---

## Sprint activo

**Sprint 4 — Dashboard básico** (pendiente de inicio)

## Estado actual

Sprint 3 completado y mergeado a `develop` (PR #5). La extensión Chrome para PedidosYa está funcional y lista para instalar.

## Qué se hizo (Sprint 3 — Extensión PedidosYa)

- `extensions/pedidosya/src/constants.ts` — `STORAGE_KEYS`, `DEFAULTS`, `RETRY`, `PEDIDOSYA_ORDER_ENDPOINTS`, `MESSAGE_TYPES`
- `extensions/pedidosya/src/extension.types.ts` — `QueueItem`, `StoredConfig`, `PedidosYaOrderDetail`, `InterceptedRequest`
- `extensions/pedidosya/src/storage.ts` — wrappers de `chrome.storage.local` con `chrome.runtime.lastError`
- `extensions/pedidosya/src/api.ts` — `sendOrders()` POST a `/integrations/orders/import` con `X-Api-Key`
- `extensions/pedidosya/src/parser.ts` — `tryExtractOrder()` + `parseOrder()` + `mapStatus()` (29 tests)
- `extensions/pedidosya/src/injected.ts` — override de `window.fetch` en contexto de página
- `extensions/pedidosya/src/content.ts` — inyecta `injected.js`, reenvía eventos a `background`
- `extensions/pedidosya/src/background.ts` — service worker con cola offline + reintentos exponenciales
- `extensions/pedidosya/src/popup/` — estado de conexión + input de API Key
- `extensions/pedidosya/build.mjs` — build programático Vite (cada entry point como IIFE separado)
- `extensions/pedidosya/manifest.json` — Manifest v3, sin `"type": "module"` en background
- 48 tests totales pasando (6 storage + 3 api + 29 parser + 10 background)

## Deuda técnica registrada durante Sprint 3

- **Race condition en `background.ts`**: `enqueueOrder` no se awaita antes de `triggerProcessQueue`, lo que puede causar que un pedido sea sobrescrito por el `saveQueue` del proceso de cola. Ver issue en PR #5.

## Próximo paso inmediato

**Fase exploratoria de PedidosYa**: el usuario quiere capturar requests reales del panel de PedidosYa para analizar la estructura real de las respuestas y actualizar el parser con datos reales. Diseñar un mecanismo de logging/captura desde la extensión.

Luego: comenzar **Sprint 4** (dashboard básico — métricas, lista de pedidos, configuración).
Ver `docs/TASKS.md` para tareas pendientes.

## Commits del Sprint 3

- `d48a226` — chore: scaffold extensión PedidosYa — Vite + Vitest + Manifest v3
- `eacb019` — feat: constants, tipos y storage wrappers para extensión PedidosYa
- `73b19fc` — feat: api.ts — sendOrders con X-Api-Key hacia backend Orderhub
- `5d6e817` — feat: parser.ts — PedidosYa response a ImportedOrder con TDD
- `b2fa3a9` — feat: interceptor fetch — injected.ts + content.ts (Manifest v3)
- `501be07` — feat: background service worker — cola offline con reintentos exponenciales
- `34e5fde` — feat: popup — estado de conexión, API Key input, pedidos pendientes
- `dc912b4` — feat: build extensión PedidosYa — dist instalable en Chrome
- `e64d7e7` — fix: centralizar MESSAGE_TYPES en constants, arreglar formato dev build
- `5edfe06` — Merge PR #5 → develop

## Decisiones recientes

- Rollup no soporta `format: 'iife'` con múltiples entry points → `build.mjs` programático (un build por entry).
- Content scripts en Chrome MV3 no pueden ser ES modules → IIFE obligatorio.
- `injected.ts` duplica `ORDER_URL_PATTERNS` intencionalmente (no puede importar módulos en contexto de página).
