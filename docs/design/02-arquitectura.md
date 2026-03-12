# Arquitectura del sistema

## Visión general

```
Plataformas externas (PedidosYa, Uber Eats, Rappi, CSV, Manual...)
        ↓
Conectores / Extensiones  ←  cada plataforma tiene el suyo
        ↓
Backend central (core del sistema)
        ↓
Base de datos
        ↓
Dashboard / Utilidades del negocio
```

## Principio clave

El core del sistema es completamente independiente de las plataformas externas.
Cada conector encapsula las reglas y particularidades de su plataforma.
El backend siempre trabaja con el modelo de datos interno normalizado.

---

## Capas del sistema

### 1. Core (backend)

Maneja toda la lógica de negocio. No conoce nada de PedidosYa ni de ninguna plataforma.

Responsabilidades:
- Gestión de pedidos
- Gestión de productos y catálogo
- Gestión de gastos
- Cálculo de métricas y comisiones
- Cierres diarios
- Reportes
- Gestión de usuarios y permisos

### 2. Capa de conectores

Cada plataforma tiene su propio conector. Cada conector:
- Obtiene datos de su plataforma
- Encapsula las reglas de negocio de esa plataforma (cancelaciones, comisiones, etc.)
- Normaliza los datos al formato interno estándar
- Los envía al backend

Conectores planificados:
- `connector-pedidosya-extension` (Chrome Extension — MVP)
- `connector-ubereats-extension`
- `connector-rappi-extension`
- `connector-csv-import`
- `connector-manual`
- `connector-whatsapp`

### 3. Frontend / Dashboard

App web responsive (mobile-first, PWA).

Muestra:
- Ventas del día
- Pedidos del día
- Ticket promedio
- Comisión estimada (si está configurada)
- Margen estimado (si hay costos cargados)
- Ranking de productos
- Gastos
- Metas de ventas
- Reportes semanales y mensuales
- Cierre diario

---

## Stack tecnológico

| Capa | Stack |
|---|---|
| Backend | Node.js + NestJS |
| Base de datos | PostgreSQL + Prisma |
| Job queues / cache | Redis + BullMQ |
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui |
| Data fetching | TanStack Query (React Query) |
| Formularios | React Hook Form + Zod |
| i18n | react-i18next |
| Fechas / timezone | date-fns + date-fns-tz |
| Linting / Formatting | Biome |
| Extensión Chrome | TypeScript + Vite + Manifest v3 |
| Tipos compartidos | @orderhub/types (pnpm workspace package) |
| PWA | Next.js PWA |

---

## Estructura del monorepo

```
orderhub/
├── apps/
│   ├── api/          ← NestJS backend
│   └── web/          ← Next.js frontend
├── extensions/
│   └── pedidosya/    ← Chrome Extension
│       ├── manifest.json
│       └── src/
│           ├── content.ts
│           ├── background.ts
│           ├── parser.ts
│           ├── interceptor.ts
│           └── api.ts
├── packages/
│   └── types/        ← tipos compartidos (ImportedOrder, etc.)
└── docs/
```
