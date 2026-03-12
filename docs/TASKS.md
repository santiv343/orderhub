# Orderhub — Task Tracker

Este documento es la fuente de verdad del estado del proyecto. Se actualiza al completar cada tarea.
Leerlo al inicio de cada sesión para retomar contexto sin necesidad de re-explorar el código.

---

## Estado General

| Sprint | Estado |
|--------|--------|
| Sprint 0 — Scaffold monorepo | ✅ Completo |
| Refactor pre-Sprint 2 | ✅ Completo |
| Sprint 2 — Órdenes y productos | ⏳ Pendiente |
| Sprint 3 — Gastos y cierre diario | ⏳ Pendiente |
| Sprint 4 — Conectores | ⏳ Pendiente |
| Sprint 5 — Reportes y admin | ⏳ Pendiente |

---

## Refactor pre-Sprint 2

Spec completo en: `docs/superpowers/specs/2026-03-12-code-improvements-design.md`

### Capa 1 — DX & Consistencia

| # | Tarea | Estado |
|---|-------|--------|
| 1.1 | Eliminar `apps/web/src/app/auth/` y `dashboard/` (rutas duplicadas) | ✅ Completo |
| 1.2 | Completar `apps/web/src/i18n/locales/en.json` (claves de auth faltantes) | ✅ Completo |
| 1.3 | `login.dto.ts`: `@MinLength(1)` → `@MinLength(8)` en password | ✅ Completo |
| 1.4 | `auth.service.ts`: `tx: any` → `tx: Prisma.TransactionClient` | ✅ Completo |
| 1.5 | `.env.example`: agregar `NEXT_PUBLIC_API_URL` | ✅ Completo |

### Capa 2 — Arquitectura y Seguridad API

| # | Tarea | Estado |
|---|-------|--------|
| 2.1 | Crear `UserRepository` en `modules/auth/repositories/` | ✅ Completo |
| 2.2 | Refactorizar `AuthService` para usar `UserRepository` | ✅ Completo |
| 2.3 | Crear `UserResponseDto` y `AuthResponseDto` | ✅ Completo |
| 2.4 | Instalar y configurar `@nestjs/throttler` con rate limiting en auth | ✅ Completo |
| 2.5 | Implementar refresh token rotation con detección de robo | ✅ Completo |
| 2.6 | Instalar y configurar `@fastify/helmet` | ✅ Completo |
| 2.7 | Cookie `secure: true` solo en producción | ✅ Completo |
| 2.8 | Reemplazar `process.env` sueltos por `ConfigService` | ✅ Completo |

### Capa 3 — Frontend

| # | Tarea | Estado |
|---|-------|--------|
| 3.1 | Setup `shadcn/ui` + instalar componentes base (button, input, form, card, label) | ✅ Completo |
| 3.2 | Reemplazar inputs crudos en login/register con componentes shadcn | ✅ Completo |
| 3.3 | Crear `apps/web/src/stores/auth.store.ts` con Zustand | ✅ Completo |
| 3.4 | Crear `apps/web/src/hooks/use-auth.ts` | ✅ Completo |
| 3.5 | Mejorar `apps/web/src/lib/api.ts` (env, unwrap, 401 handler) | ✅ Completo |
| 3.6 | Crear `apps/web/src/lib/env.ts` con validación Zod de variables de entorno | ✅ Completo |

---

## Sprint 2 — Órdenes y Productos

> ⚠️ No iniciar hasta completar el Refactor pre-Sprint 2

### API

| # | Tarea | Estado |
|---|-------|--------|
| S2-1 | Crear `OrderModule` con controller, service, repository | ⏳ Pendiente |
| S2-2 | `GET /orders` — listar órdenes por location con filtros y paginación | ⏳ Pendiente |
| S2-3 | `GET /orders/:id` — detalle de orden | ⏳ Pendiente |
| S2-4 | `PATCH /orders/:id/status` — cambiar estado de orden | ⏳ Pendiente |
| S2-5 | `POST /orders` — crear orden manual | ⏳ Pendiente |
| S2-6 | `POST /orders/import` — importar orden desde conector externo | ⏳ Pendiente |
| S2-7 | Crear `ProductModule` (CRUD básico) | ⏳ Pendiente |
| S2-8 | Setup `@nestjs/swagger` para documentar API | ⏳ Pendiente |

### Web

| # | Tarea | Estado |
|---|-------|--------|
| S2-9 | Página `/dashboard/orders` — lista de órdenes con `@tanstack/table` | ⏳ Pendiente |
| S2-10 | Página `/dashboard/orders/:id` — detalle de orden | ⏳ Pendiente |
| S2-11 | Página `/dashboard/products` — lista de productos | ⏳ Pendiente |
| S2-12 | Componente de cambio de estado de orden | ⏳ Pendiente |
| S2-13 | Dashboard home con resumen del día | ⏳ Pendiente |

---

## Sprint 3 — Gastos y Cierre Diario

| # | Tarea | Estado |
|---|-------|--------|
| S3-1 | `ExpenseModule` — CRUD de gastos por categoría | ⏳ Pendiente |
| S3-2 | `DailyCloseModule` — apertura, cierre y reconciliación | ⏳ Pendiente |
| S3-3 | Web: páginas de gastos y cierre diario | ⏳ Pendiente |

---

## Sprint 4 — Conectores

| # | Tarea | Estado |
|---|-------|--------|
| S4-1 | Setup `bullmq` para queue de órdenes entrantes | ⏳ Pendiente |
| S4-2 | Conector Webhook — endpoint que recibe órdenes externas | ⏳ Pendiente |
| S4-3 | Conector API Polling — job periódico que consulta fuentes | ⏳ Pendiente |
| S4-4 | `LocationApiKey` — generar y rotar API keys por location | ⏳ Pendiente |
| S4-5 | Web: página de gestión de conectores | ⏳ Pendiente |

---

## Sprint 5 — Reportes, Email y Admin

| # | Tarea | Estado |
|---|-------|--------|
| S5-1 | Setup `recharts` para gráficos | ⏳ Pendiente |
| S5-2 | Página de reportes — ventas por período, por fuente | ⏳ Pendiente |
| S5-3 | Setup `resend` para emails transaccionales | ⏳ Pendiente |
| S5-4 | Verificación de email post-registro | ⏳ Pendiente |
| S5-5 | Reset de contraseña por email | ⏳ Pendiente |
| S5-6 | Panel admin — gestión de organizaciones y usuarios | ⏳ Pendiente |

---

## Deuda Técnica Registrada

| # | Descripción | Severidad | Referencia |
|---|-------------|-----------|------------|
| DT-1 | Sin tests (Jest/Vitest no configurados) | Media | Pendiente Sprint 2+ |
| DT-2 | Real-time de órdenes no implementado (`socket.io`) | Media | Sprint 4+ |
| DT-3 | Redis no usado todavía (solo en docker-compose) | Baja | Sprint 4 (bullmq) |
| DT-4 | S3/LocalStack configurado pero sin uso | Baja | Sprint 5 (uploads) |
| DT-5 | Rate limiting solo en auth, no en otros endpoints | Baja | Sprint 2+ |
| DT-6 | Dashboard página usa texto hardcodeado en español, no usa t() | Baja | Sprint 2 — usar useTranslation |
| DT-7 | Layouts de auth/dashboard usan bg-gray-50 en vez de tokens semánticos de shadcn | Baja | Sprint 2 |
| DT-8 | shadcn form component no instalado (incompatibilidad v4 con Tailwind v3) — forms usan inputs directos | Media | Sprint 2 — evaluar upgrade a Tailwind v4 o usar shadcn@legacy |

---

## Convenciones del Proyecto

- **API base URL:** `/api/v1/...`
- **Respuestas exitosas:** `{ data: T }`
- **Errores:** `{ error: { code: string, message: string } }`
- **Cookies:** `access_token` (15m) + `refresh_token` (7d), httpOnly
- **Roles:** `SUPER_ADMIN > ORG_ADMIN > LOCATION_MANAGER > OPERATOR`
- **Zona horaria:** `America/Buenos_Aires`
- **Moneda:** ARS por defecto

---

## Cómo usar este documento

Al iniciar una sesión nueva:
1. Leer la tabla de **Estado General** para ubicarse
2. Ir al sprint/capa activa y ver qué tareas están pendientes
3. Al completar una tarea, cambiar `⏳ Pendiente` → `✅ Completo`
4. Si se descubre nueva deuda técnica, agregarla a la sección correspondiente

**Leyenda:**
- ✅ Completo
- 🔄 En progreso
- ⏳ Pendiente
- ❌ Bloqueado
