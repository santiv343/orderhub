# Orderhub — Decisiones de Arquitectura

Registro de decisiones técnicas relevantes. Cada entrada tiene contexto y razón para poder evaluarla en el futuro.

---

## ADR-001 — Monorepo con pnpm + Turborepo

**Fecha:** 2026-03-12 (Sprint 0)
**Estado:** Vigente

**Decisión:** Monorepo con tres workspaces: `apps/api`, `apps/web`, `packages/types`.

**Por qué:** Permite compartir tipos entre API y Web sin publicar paquetes. Turborepo cachea builds y paraleliza tareas. pnpm es más eficiente en disco que npm/yarn para monorepos.

---

## ADR-002 — NestJS + Fastify (no Express)

**Fecha:** 2026-03-12 (Sprint 0)
**Estado:** Vigente

**Decisión:** NestJS con adaptador Fastify en lugar del default Express.

**Por qué:** Fastify tiene mejor throughput (~30% más requests/seg). NestJS provee estructura, inyección de dependencias y decoradores que escalan bien. La combinación es el stack estándar para APIs NestJS en producción.

---

## ADR-003 — JWT en cookies httpOnly (no Authorization header)

**Fecha:** 2026-03-12 (Sprint 0)
**Estado:** Vigente

**Decisión:** Access token y refresh token en cookies httpOnly con SameSite=lax.

**Por qué:** Las cookies httpOnly no son accesibles desde JavaScript, eliminando el vector de ataque XSS que existe cuando se guarda el token en localStorage o memoria del cliente. El frontend no necesita gestionar tokens manualmente.

**Trade-off:** Requiere CORS configurado correctamente. En requests cross-origin se necesita `credentials: 'include'`.

---

## ADR-004 — Prisma como ORM

**Fecha:** 2026-03-12 (Sprint 0)
**Estado:** Vigente

**Decisión:** Prisma ORM con PostgreSQL.

**Por qué:** Tipado end-to-end desde el schema, migraciones automáticas, excelente integración con TypeScript. Alternativas (TypeORM, Drizzle) tienen trade-offs de complejidad o madurez que no justifican el cambio para este proyecto.

---

## ADR-005 — Repository Pattern en la API

**Fecha:** 2026-03-12 (Refactor pre-Sprint 2)
**Estado:** Vigente

**Decisión:** Introducir capa de repositorios (`UserRepository`, etc.) entre servicios y Prisma.

**Por qué:** Los servicios no deben conocer detalles de acceso a datos. Los repositorios son mockeables en tests. Cuando un modelo se usa en múltiples módulos (ej: `User` en `AuthModule` y `UserModule`), el repositorio es el punto de reutilización.

**Estructura:**
```
modules/<domain>/
├── repositories/
│   └── <domain>.repository.ts
├── <domain>.service.ts
└── <domain>.controller.ts
```

---

## ADR-006 — shadcn/ui como librería de componentes

**Fecha:** 2026-03-12 (Refactor pre-Sprint 2)
**Estado:** Vigente

**Decisión:** shadcn/ui sobre otras opciones (MUI, Chakra, Mantine).

**Por qué:** shadcn/ui no es una dependencia — los componentes se copian al repo y son código propio. Built on Radix UI (accesible) + Tailwind (ya en uso). Sin lock-in, sin override de estilos en guerra con Tailwind, 100% personalizable.

---

## ADR-007 — Zustand para UI state, React Query para server state

**Fecha:** 2026-03-12 (Refactor pre-Sprint 2)
**Estado:** Vigente

**Decisión:** React Query maneja todo el estado del servidor (fetching, caching, invalidación). Zustand maneja estado de UI puro (sidebar abierto, usuario en memoria cliente, filtros activos).

**Por qué:** Redux es overkill para este scope. Zustand es 1 KB, sin boilerplate, sin providers anidados. La separación server state / UI state evita el anti-patrón de guardar respuestas de API en Redux manualmente.

---

## ADR-008 — Respuestas API envueltas en `{ data: T }`

**Fecha:** 2026-03-12 (Sprint 0)
**Estado:** Vigente

**Decisión:** Todas las respuestas exitosas de la API tienen forma `{ data: T }`. Todos los errores tienen forma `{ error: { code, message } }`.

**Por qué:** Permite al cliente distinguir siempre éxito de error por shape, no por status code. El `ResponseInterceptor` de NestJS aplica esto globalmente sin modificar los controllers.

**Importante:** El cliente `api.ts` en Web hace unwrap automático de `{ data: T }` → `T`. Los consumers del cliente nunca ven el wrapper.

---

## ADR-009 — Librería roadmap para sprints futuros

**Fecha:** 2026-03-12
**Estado:** Referencia

| Librería | Sprint | Para qué |
|----------|--------|----------|
| `@tanstack/table` | Sprint 2 | Tablas de órdenes/productos con sorting y paginación |
| `@nestjs/swagger` | Sprint 2 | Documentación auto-generada desde DTOs |
| `recharts` | Sprint reportes | Gráficos de ventas y cierres |
| `bullmq` | Sprint conectores | Queue de órdenes entrantes (usa Redis ya configurado) |
| `socket.io` | Sprint real-time | Actualizaciones de órdenes en vivo |
| `resend` | Sprint email | Emails transaccionales (usa Mailpit en dev) |
