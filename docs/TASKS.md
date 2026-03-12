# Orderhub — Task Tracker

Este documento es la fuente de verdad del estado del proyecto. Se actualiza al completar cada tarea.
Leerlo al inicio de cada sesión para retomar contexto sin necesidad de re-explorar el código.

> **Referencia:** El plan completo del MVP está en `docs/design/10-alcance-mvp.md`

---

## Estado General

| Sprint | Objetivo | Estado |
|--------|----------|--------|
| Sprint 0 — Scaffold monorepo | Monorepo funcional, DB corriendo | ✅ Completo |
| Sprint 1 — Auth y estructura base | Registro, login, JWT, guards | ✅ Completo |
| Refactor pre-Sprint 2 | DX, arquitectura, frontend modernization | ✅ Completo |
| Sprint 2 — Importación de pedidos | Endpoint import + API Keys + deduplicación | ⏳ Pendiente |
| Sprint 3 — Extensión PedidosYa | Intercepción, parser, cola offline | ⏳ Pendiente |
| Sprint 4 — Dashboard básico | Métricas del día, lista de pedidos, config | ⏳ Pendiente |
| Sprint 5 — QA y deploy | Testing e2e, polish, producción | ⏳ Pendiente |

---

## Sprint 2 — Importación de pedidos

**Objetivo:** el backend puede recibir, validar y guardar pedidos de cualquier fuente.

### API

| # | Tarea | Estado |
|---|-------|--------|
| S2-1 | Crear enums `OrderSource`, `OrderStatus` en `@orderhub/types` | ⏳ Pendiente |
| S2-2 | Crear `OrderModule` con controller, service, repository | ⏳ Pendiente |
| S2-3 | `POST /integrations/orders/import` — autenticado con API Key (`X-Api-Key` header) | ⏳ Pendiente |
| S2-4 | Validación del contrato `ImportedOrder` (DTO + class-validator) | ⏳ Pendiente |
| S2-5 | Deduplicación: `unique(locationId, source, externalId)` — si existe → 200 sin error | ⏳ Pendiente |
| S2-6 | `POST /api-keys` — generar nueva API Key (mostrar solo una vez, guardar hash) | ⏳ Pendiente |
| S2-7 | `GET /api-keys` — listar keys activas con label y fecha | ⏳ Pendiente |
| S2-8 | `DELETE /api-keys/:id` — revocar key | ⏳ Pendiente |
| S2-9 | Guard de API Key para el endpoint de import | ⏳ Pendiente |

### Tests

| # | Tarea | Estado |
|---|-------|--------|
| S2-T1 | Setup Jest/Vitest en `apps/api` | ⏳ Pendiente |
| S2-T2 | Test: importar pedido nuevo → se guarda correctamente | ⏳ Pendiente |
| S2-T3 | Test: importar mismo pedido dos veces → deduplicación funciona | ⏳ Pendiente |
| S2-T4 | Test: pedido con campos opcionales vacíos → se guarda igual | ⏳ Pendiente |
| S2-T5 | Test: API Key inválida → 401 | ⏳ Pendiente |

**Definition of Done:**
- `POST /integrations/orders/import` con API Key válida guarda el pedido
- El mismo pedido enviado dos veces no genera duplicados
- Un pedido con solo `source`, `externalId` y `total` se guarda correctamente

---

## Sprint 3 — Extensión PedidosYa

**Objetivo:** la extensión detecta pedidos en el panel de PedidosYa y los envía al backend automáticamente.

| # | Tarea | Estado |
|---|-------|--------|
| S3-1 | `interceptor.ts` — override de `window.fetch` y `XMLHttpRequest` | ⏳ Pendiente |
| S3-2 | Mapear API de PedidosYa: identificar endpoints con datos de pedidos | ⏳ Pendiente |
| S3-3 | `parser.ts` — transformar response de PedidosYa a `ImportedOrder` | ⏳ Pendiente |
| S3-4 | Cola offline con reintentos en `background.ts` (service worker) | ⏳ Pendiente |
| S3-5 | Popup: estado de conexión + input de API Key | ⏳ Pendiente |
| S3-6 | Build de la extensión instalable en Chrome/Edge | ⏳ Pendiente |

**Definition of Done:**
- Con el panel de PedidosYa abierto, un pedido nuevo aparece en el backend en < 5 segundos
- Si el backend está caído, el pedido se guarda localmente y se reintenta

---

## Sprint 4 — Dashboard básico

**Objetivo:** el usuario puede ver sus pedidos y métricas del día.

### API

| # | Tarea | Estado |
|---|-------|--------|
| S4-1 | `GET /dashboard/today` — ventas totales, cantidad de pedidos, ticket promedio | ⏳ Pendiente |
| S4-2 | `GET /orders` — lista paginada con filtros por fecha/fuente/estado | ⏳ Pendiente |
| S4-3 | `GET /orders/:id` — detalle con items | ⏳ Pendiente |

### Web

| # | Tarea | Estado |
|---|-------|--------|
| S4-4 | Layout principal (sidebar, navbar) | ⏳ Pendiente |
| S4-5 | Página dashboard: tarjetas de métricas del día | ⏳ Pendiente |
| S4-6 | Lista de pedidos del día con canal de origen, hora, total, estado | ⏳ Pendiente |
| S4-7 | Detalle de pedido (items, notas, cliente) | ⏳ Pendiente |
| S4-8 | Página `Settings → API Keys` (generar, listar, revocar) | ⏳ Pendiente |
| S4-9 | Actualización automática cada 30 segundos | ⏳ Pendiente |

---

## Sprint 5 — QA y deploy

| # | Tarea | Estado |
|---|-------|--------|
| S5-1 | Tests e2e con Playwright (flujo completo: registro → extensión → pedido → dashboard) | ⏳ Pendiente |
| S5-2 | Error handling completo (toasts, retry, sesión expirada) | ⏳ Pendiente |
| S5-3 | Estados de carga y vacíos en todas las vistas | ⏳ Pendiente |
| S5-4 | Deploy backend (Railway/Render) + frontend (Vercel) | ⏳ Pendiente |
| S5-5 | Base de datos de producción + HTTPS | ⏳ Pendiente |

---

## Deuda Técnica Registrada

| # | Descripción | Severidad | Referencia |
|---|-------------|-----------|------------|
| DT-1 | Sin tests (Jest/Vitest no configurados) | Media | Sprint 2 |
| DT-2 | Real-time de órdenes no implementado (`socket.io`) | Media | Sprint 4+ |
| DT-3 | Redis no usado todavía (solo en docker-compose) | Baja | Sprint 4 (bullmq) |
| DT-4 | S3/LocalStack configurado pero sin uso | Baja | Sprint 5 (uploads) |
| DT-5 | Rate limiting solo en auth, no en otros endpoints | Baja | Sprint 2+ |
| DT-6 | Dashboard página usa texto hardcodeado en español, no usa t() | Baja | Sprint 4 |
| DT-7 | Layouts de auth/dashboard usan bg-gray-50 en vez de tokens semánticos de shadcn | Baja | Sprint 4 |

---

## Convenciones del Proyecto

- **API base URL:** `/api/v1/...`
- **Respuestas exitosas:** `{ data: T }` | **Errores:** `{ error: { code: string, message: string } }`
- **Cookies:** `access_token` (15m) + `refresh_token` (7d), httpOnly
- **Importación:** `POST /api/v1/integrations/orders/import` con header `X-Api-Key`
- **API Key format:** prefix `ohk_` + 32 chars random, guardar solo el hash
- **Roles:** `SUPER_ADMIN > ORG_ADMIN > LOCATION_MANAGER > OPERATOR`
- **Zona horaria:** `America/Buenos_Aires` | **Moneda:** ARS por defecto

---

## Cómo usar este documento

Al iniciar una sesión nueva:
1. Leer la tabla de **Estado General** para ubicarse
2. Ir al sprint activo y ver qué tareas están pendientes
3. Al completar una tarea, cambiar `⏳ Pendiente` → `✅ Completo`
4. Si se descubre nueva deuda técnica, agregarla a la sección correspondiente

**Leyenda:** ✅ Completo | 🔄 En progreso | ⏳ Pendiente | ❌ Bloqueado
