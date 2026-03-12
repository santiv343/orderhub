# Prácticas de código

Estándares de desarrollo para mantener unicidad y consistencia en todo el codebase.
Estas reglas aplican a todos los módulos, en todos los entornos.

---

## Principios generales

1. **Sin magic strings ni magic numbers** — todo en constantes
2. **Sin `process.env` suelto** — todo a través de `config.ts` tipado
3. **Sin strings de estado/rol/fuente hardcodeados** — usar enums
4. **Tipos separados del código de negocio** — archivos dedicados
5. **Errores centralizados** — clases custom con códigos únicos
6. **Mensajes al usuario en archivos de i18n** — nunca inline
7. **Un archivo, una responsabilidad**

---

## TypeScript — configuración estricta

`"strict": true` obligatorio en todos los `tsconfig.json` del monorepo.
Sin excepciones. Si el compilador se queja, se arregla el código, no la config.

## Imports absolutos

En todos los proyectos del monorepo usar alias de paths, nunca paths relativos largos:

```typescript
// ✅ correcto
import { OrderCard } from '@/components/features/OrderCard'
import { formatMoney } from '@/lib/formatters'
import { OrderStatus } from '@orderhub/types'

// ❌ incorrecto
import { OrderCard } from '../../../components/features/OrderCard'
```

Configurado en `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

El package de tipos compartidos se importa como `@orderhub/types` desde cualquier app del monorepo.

---

## Formularios

**React Hook Form + Zod** en todos los formularios del frontend.

- El schema Zod define la validación
- React Hook Form lo integra con `zodResolver`
- El mismo schema Zod puede reutilizarse en el backend para validación de DTOs

```typescript
const schema = z.object({
  amount: z.number().positive(),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
})

const form = useForm({ resolver: zodResolver(schema) })
```

---

## Data fetching

**TanStack Query (React Query)** para todo el data fetching del frontend.

- Keys centralizadas en `constants/query-keys.ts`
- Nunca hacer fetch directamente en componentes
- Invalidar queries al mutar datos

```typescript
// constants/query-keys.ts
export const QUERY_KEYS = {
  orders: {
    today: (locationId: string) => ['orders', 'today', locationId],
    detail: (orderId: string) => ['orders', orderId],
  },
  dashboard: {
    today: (locationId: string) => ['dashboard', 'today', locationId],
  },
} as const
```

---

## Job queues

**BullMQ** con Redis para tareas asíncronas:

- Cron de cierres diarios (uno por timezone de cada Location)
- Reintento de notificaciones
- Tareas pesadas fuera del request cycle

---

## Fechas y timezones

**date-fns + date-fns-tz** para todo manejo de fechas.

```typescript
import { startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

// Siempre calcular "hoy" en base a la timezone del Location
function getTodayBoundsUTC(timezone: string) {
  const nowInZone = toZonedTime(new Date(), timezone)
  return {
    from: fromZonedTime(startOfDay(nowInZone), timezone),
    to:   fromZonedTime(endOfDay(nowInZone), timezone),
  }
}
```

Todos los queries de "hoy" (dashboard, cierre diario, métricas) usan esta función.

---

## Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos | kebab-case | `order-service.ts` |
| Componentes React | PascalCase | `OrderCard.tsx` |
| Funciones y variables | camelCase | `calculateCommission()` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Tipos e interfaces | PascalCase | `ImportedOrder` |
| Enums | PascalCase (key PascalCase) | `OrderStatus.Delivered` |
| Tablas DB | snake_case | `order_items` |
| Rutas API | kebab-case | `/api/v1/daily-close` |
| Variables de entorno | SCREAMING_SNAKE_CASE | `DATABASE_URL` |
| Branches git | kebab-case con prefijo | `feature/order-import` |

---

## Estructura de carpetas

### Backend (NestJS)

```
apps/api/src/
├── config/
│   └── config.ts          ← validación Zod de todas las env vars
├── constants/
│   ├── errors.ts          ← códigos de error centralizados
│   ├── events.ts          ← nombres de eventos SSE/WS
│   └── limits.ts          ← límites del sistema (paginación, retry, etc.)
├── types/
│   ├── order.types.ts
│   ├── user.types.ts
│   └── index.ts
├── enums/
│   ├── order-status.enum.ts
│   ├── order-source.enum.ts
│   ├── user-role.enum.ts
│   └── index.ts
├── errors/
│   ├── app.error.ts       ← clase base de error
│   ├── order.errors.ts
│   └── auth.errors.ts
├── modules/
│   ├── auth/
│   ├── orders/
│   ├── products/
│   ├── expenses/
│   └── ...
└── shared/
    ├── guards/
    ├── interceptors/
    ├── decorators/
    └── utils/
```

### Frontend (Next.js)

```
apps/web/src/
├── constants/
│   ├── routes.ts          ← rutas de la app como constantes
│   ├── query-keys.ts      ← keys de React Query centralizadas
│   └── ui.ts              ← valores de UI (breakpoints, etc.)
├── types/
│   └── index.ts
├── enums/
│   └── index.ts
├── i18n/
│   ├── locales/
│   │   ├── es.json
│   │   └── en.json
│   └── config.ts
├── lib/
│   ├── api.ts             ← cliente HTTP tipado
│   ├── utils.ts
│   └── formatters.ts      ← dinero, fechas, porcentajes
├── components/
│   ├── ui/                ← componentes base (shadcn)
│   └── features/          ← componentes de negocio
└── app/                   ← Next.js App Router
```

---

## Enums — siempre en lugar de strings

```typescript
// ✅ correcto
export enum OrderSource {
  PedidosYa = 'pedidosya',
  UberEats = 'ubereats',
  Rappi = 'rappi',
  Manual = 'manual',
  Whatsapp = 'whatsapp',
  Csv = 'csv',
}

export enum OrderStatus {
  Imported = 'imported',
  Confirmed = 'confirmed',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
  PartialRefund = 'partial_refund',
}

export enum UserRole {
  Owner = 'owner',
  Admin = 'admin',
  Manager = 'manager',
  Operator = 'operator',
  Viewer = 'viewer',
}

export enum CancellationReason {
  Platform = 'platform',
  Customer = 'customer',
  Seller = 'seller',
}

// ❌ incorrecto
const source = 'pedidosya'
const status = 'delivered'
```

---

## Constantes — sin magic values

```typescript
// constants/limits.ts
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

export const RETRY = {
  MAX_ATTEMPTS: 10,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 30_000,
} as const

export const API_KEY = {
  PREFIX: 'ohk_',
  LENGTH: 32,
} as const

export const DAILY_CLOSE = {
  CRON_HOUR: 0,
  CRON_MINUTE: 0,
} as const

// constants/errors.ts
export const ERROR_CODES = {
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_DUPLICATE: 'ORDER_DUPLICATE',
  INVALID_API_KEY: 'INVALID_API_KEY',
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',
  DAILY_CLOSE_LOCKED: 'DAILY_CLOSE_LOCKED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const
```

---

## Errores — clases custom tipadas

```typescript
// errors/app.error.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

// errors/order.errors.ts
export class OrderNotFoundError extends AppError {
  constructor(orderId: string) {
    super(ERROR_CODES.ORDER_NOT_FOUND, `Order ${orderId} not found`, 404)
  }
}

export class OrderDuplicateError extends AppError {
  constructor() {
    super(ERROR_CODES.ORDER_DUPLICATE, 'Order already exists', 409)
  }
}
```

---

## Configuración — tipada con Zod

```typescript
// config/config.ts
import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_FROM: z.string().email(),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_BUCKET: z.string(),
  SENTRY_DSN: z.string().optional(),
})

export const config = configSchema.parse(process.env)
export type Config = z.infer<typeof configSchema>
```

Si falta una variable, la app no arranca y Zod indica exactamente cuál.

---

## Dinero — NUNCA floats, siempre Decimal

Todos los montos se almacenan como **`Decimal` en Prisma** (`@db.Decimal(12, 2)`).
Nunca usar `Float` en el schema de Prisma para montos de dinero.
La conversión a display ocurre solo en la capa de presentación.

```prisma
// ✅ correcto — Prisma schema
model Order {
  total        Decimal  @db.Decimal(12, 2)
  subtotal     Decimal? @db.Decimal(12, 2)
  discount     Decimal? @db.Decimal(12, 2)
  deliveryFee  Decimal? @db.Decimal(12, 2)
}

// ❌ incorrecto
total  Float
```

```typescript
// ✅ correcto — formatear en el frontend
formatMoney(order.total, location.currency)

// lib/formatters.ts
export function formatMoney(amount: Prisma.Decimal | number, currency: string): string {
  const value = typeof amount === 'number' ? amount : amount.toNumber()
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}
```

`commissionRate` y similares (porcentajes) pueden ser `Float` ya que son ratios, no montos.

---

## Respuesta estándar de la API

Todos los endpoints devuelven el mismo envelope:

```typescript
// Éxito con datos
{
  "data": { ... }
}

// Éxito con lista paginada
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}

// Error
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "El pedido no existe"
  }
}
```

Un interceptor global en NestJS aplica este formato a todos los responses.

---

## Versionado de API

Todas las rutas del backend van bajo `/api/v1/`.

```
/api/v1/auth/login
/api/v1/orders
/api/v1/integrations/orders/import
```

Cuando haya cambios breaking, se agrega `/api/v2/` manteniendo v1 activa durante la transición.

---

## Fechas y zonas horarias

- **Base de datos:** siempre UTC
- **API:** siempre ISO 8601 con timezone (`2026-03-11T19:32:00Z`)
- **Frontend:** convierte a la timezone del `Location` solo para mostrar
- **Cierre diario:** el cron calcula la medianoche según `location.timezone`

```typescript
// ✅ correcto
createdAt: new Date().toISOString()  // UTC

// ✅ mostrar en frontend
formatDate(order.createdAt, location.timezone)

// ❌ incorrecto
createdAt: new Date().toLocaleDateString()  // timezone del servidor
```

---

## i18n — sin strings hardcodeados en UI

```typescript
// ✅ correcto
const { t } = useTranslation()
<p>{t('dashboard.metrics.totalSales')}</p>

// ❌ incorrecto
<p>Ventas del día</p>
```

Estructura de keys: `modulo.seccion.elemento`

```json
// i18n/locales/es.json
{
  "dashboard": {
    "metrics": {
      "totalSales": "Ventas del día",
      "orderCount": "Pedidos",
      "averageTicket": "Ticket promedio"
    }
  },
  "errors": {
    "orderNotFound": "El pedido no existe",
    "networkError": "Error de conexión. Reintentando..."
  }
}
```

---

## Testing

**Estructura:**
- Tests unitarios colocados junto al archivo: `order.service.spec.ts`
- Tests de integración en `test/integration/`
- Tests e2e en `test/e2e/` con Playwright

**Herramientas:**
- Backend: Vitest + Supertest
- Frontend: Vitest + Testing Library
- E2E: Playwright

**Reglas:**
- Todo endpoint público tiene al menos un test de integración
- Toda función de negocio crítica (cálculo de comisión, deduplicación) tiene test unitario
- Los tests no hablan con servicios externos reales (mocks/stubs)

---

## Git workflow

### Branches

```
main       ← producción, solo via PR
develop    ← staging, integración
feature/   ← nuevas funcionalidades
fix/       ← bugfixes
chore/     ← mantenimiento, deps
```

### Commits — Conventional Commits

```
feat: add order deduplication
fix: correct commission calculation for refunds
chore: update prisma to 5.x
test: add integration tests for order import
docs: update API response format
refactor: extract money formatters to shared lib
```

### Flujo

```
feature/mi-feature
    ↓ PR a develop
develop (staging)
    ↓ PR a main (requiere review)
main (producción)
```

---

## Reglas de linting — Biome

**Biome** reemplaza completamente a ESLint + Prettier. Un solo tool, más rápido, configuración unificada.

- Sin `any` en TypeScript
- Sin `console.log` — usar el logger (Pino)
- Imports ordenados automáticamente
- Trailing commas siempre
- Sin unused variables
- Formatting automático al guardar

```json
// biome.json en la raíz del monorepo
{
  "linter": { "enabled": true },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "organizeImports": { "enabled": true }
}
```
