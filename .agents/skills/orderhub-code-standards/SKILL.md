---
name: orderhub-code-standards
description: Orderhub coding standards - use before writing any code for this project to ensure consistency across the codebase
user-invocable: true
---

# Orderhub — Estándares de Código

Aplica estas reglas en **todo** el código de este proyecto. El archivo completo está en `docs/design/13-practicas-de-codigo.md`.

## Principios

1. Sin magic strings/numbers — todo en constantes
2. Sin `process.env` suelto — todo via `ConfigService` o `config.ts` tipado
3. Sin strings de estado/rol/fuente hardcodeados — usar enums
4. Errores centralizados con clases custom y códigos únicos
5. Mensajes de UI siempre en archivos i18n, nunca inline
6. Un archivo, una responsabilidad
7. **Sin assertions defensivas** — ver sección abajo

## Sin assertions defensivas

Código senior no se defiende de sí mismo. Las assertions ocultan lógica incorrecta en lugar de arreglarla.

```typescript
// ❌ mal — assertion defensiva
function getUser(id: string) {
  assert(id, 'id must be defined')
  assert(typeof id === 'string', 'id must be string')
  const user = users.get(id)
  assert(user, 'user must exist')
  return user
}

// ✅ bien — tipos correctos + error explícito cuando corresponde
function getUser(id: string): User {
  const user = users.get(id)
  if (!user) throw new UserNotFoundError(id)
  return user
}
```

**Reglas:**
- Sin `console.assert()`, `assert()`, o librerías de assertion en código de producción
- Sin `if (!x) throw new Error('x should be defined')` innecesario — el type system previene esto
- Los errores de casos imposibles no se manejan — si algo es imposible por diseño, el tipo lo garantiza
- Si necesitás una assertion en runtime, es señal de que el tipo está mal definido — arreglar el tipo
- Validaciones **solo en los boundaries del sistema**: inputs externos (API, formularios, env vars)
- Dentro del sistema, confiar en los tipos y en el diseño

```typescript
// ❌ mal — validando lo que ya sabemos por el tipo
function processOrder(order: Order) {
  if (!order.id) throw new Error('order.id is required')      // Order.id es string, no puede ser undefined
  if (!order.items) throw new Error('items is required')      // Order.items es OrderItem[], ya tipado
}

// ✅ bien — solo validar en boundaries (DTO externo)
class CreateOrderDto {
  @IsUUID() id: string                                        // validación de input externo
  @IsArray() @ValidateNested() items: OrderItemDto[]
}
```

---

## Estándares senior

**Funciones cortas y focalizadas**
- Máximo ~20 líneas por función. Si es más larga, extraer.
- Un nombre que describe exactamente qué hace — sin sorpresas.

**No comentar lo obvio, comentar el porqué**
```typescript
// ❌ mal
// Incrementar el contador
count++

// ✅ bien — explica una decisión no obvia
// Ignoramos el primer elemento porque la API de PedidosYa siempre incluye
// un ítem de "cargo de servicio" que no corresponde a un producto real
const items = rawItems.slice(1)
```

**Early returns — sin nesting profundo**
```typescript
// ❌ mal
function process(order: Order) {
  if (order) {
    if (order.status === OrderStatus.Imported) {
      if (order.items.length > 0) {
        // lógica principal
      }
    }
  }
}

// ✅ bien
function process(order: Order) {
  if (!order) return
  if (order.status !== OrderStatus.Imported) return
  if (order.items.length === 0) return
  // lógica principal
}
```

**Inmutabilidad por defecto**
```typescript
// ✅ const por defecto, let solo cuando realmente cambia
const total = order.items.reduce((sum, item) => sum + item.price, 0)

// ✅ no mutar parámetros
function addDiscount(order: Order, discount: number): Order {
  return { ...order, total: order.total - discount }
}
```

**Evitar efectos secundarios ocultos**
- Una función que dice `getUser()` no debe escribir en la DB
- Side effects explícitos en el nombre: `saveAndNotifyUser()`, `fetchAndCacheOrders()`

**Composición sobre herencia**
```typescript
// ✅ componer con mixins/decorators en NestJS
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly notifier: NotificationService,
  ) {}
}
```

**Errores como valores en boundaries, excepciones en flujo interno**
```typescript
// En el controller (boundary): capturar y responder
@Post()
async create(@Body() dto: CreateOrderDto) {
  try {
    return { data: await this.orderService.create(dto) }
  } catch (e) {
    if (e instanceof OrderDuplicateError) throw new ConflictException(...)
    throw e
  }
}

// En el service (interno): lanzar excepciones tipadas
async create(dto: CreateOrderDto): Promise<Order> {
  const existing = await this.orderRepo.findByExternalId(dto.externalId)
  if (existing) throw new OrderDuplicateError()
  return this.orderRepo.create(dto)
}
```

---

## TypeScript

- `"strict": true` obligatorio — si el compilador se queja, arreglar el código, no la config
- Sin `any` — usar tipos explícitos o `unknown` + type guard
- Imports absolutos con alias `@/*` y `@orderhub/types`, nunca paths relativos largos

## Naming

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos | kebab-case | `order-service.ts` |
| Componentes React | PascalCase | `OrderCard.tsx` |
| Funciones/variables | camelCase | `calculateCommission()` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Tipos/interfaces/enums | PascalCase | `OrderStatus.Delivered` |
| Tablas DB | snake_case | `order_items` |
| Rutas API | kebab-case | `/api/v1/daily-close` |

## Enums obligatorios

```typescript
// packages/types o apps/api/src/enums/
export enum OrderSource { PedidosYa = 'pedidosya', UberEats = 'ubereats', Manual = 'manual' }
export enum OrderStatus { Imported = 'imported', Confirmed = 'confirmed', Delivered = 'delivered', Cancelled = 'cancelled' }
export enum UserRole { Owner = 'owner', Admin = 'admin', Manager = 'manager', Operator = 'operator' }
```

## API — respuesta estándar

```typescript
// Éxito:      { data: T }
// Lista:      { data: T[], meta: { total, page, limit, totalPages } }
// Error:      { error: { code: string, message: string } }
```

Un interceptor global en NestJS aplica este formato. Nunca devolver datos sin el envelope.

## Backend (NestJS)

- `ConfigService` para toda variable de entorno (no `process.env` directo)
- Repository pattern: services no tocan `prisma` directamente
- DTOs para todo input y output (class-validator + class-transformer)
- Errores: clases custom que extienden `AppError` con código único

```
apps/api/src/
├── config/config.ts          ← validación Zod de env vars
├── constants/errors.ts       ← códigos de error centralizados
├── constants/limits.ts       ← paginación, retry, etc.
├── enums/                    ← OrderStatus, OrderSource, UserRole, etc.
├── errors/                   ← AppError + clases específicas
└── modules/<nombre>/
    ├── <nombre>.controller.ts
    ├── <nombre>.service.ts
    ├── <nombre>.module.ts
    ├── repositories/<nombre>.repository.ts
    └── dto/
```

## Frontend (Next.js)

- React Hook Form + Zod + shadcn Form para todos los formularios
- TanStack Query para data fetching — nunca fetch directo en componentes
- Zustand solo para estado UI global (no server state)
- Todo texto de UI en `i18n/locales/es.json` y `en.json`

```
apps/web/src/
├── constants/routes.ts       ← rutas como constantes tipadas
├── constants/query-keys.ts   ← keys de React Query centralizadas
├── lib/formatters.ts         ← formatMoney, formatDate
├── components/ui/            ← shadcn (button, input, form, card, label)
└── components/features/      ← componentes de negocio
```

## Dinero

- **Siempre `Decimal` en Prisma** (`@db.Decimal(12,2)`), nunca `Float` para montos
- Conversión a display solo en la capa de presentación via `formatMoney()`

## Fechas

- Base de datos: UTC siempre
- Cálculos de "hoy": basados en `location.timezone` (usar `date-fns-tz`)
- Display: convertir a timezone del Location solo en el frontend

## Git

```
main       ← producción, solo via PR
develop    ← staging/integración
feature/   ← nuevas funcionalidades
fix/       ← bugfixes
chore/     ← mantenimiento
```

Commits en Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`

## Linting (Biome)

Sin `any`, sin `console.log` (usar logger Pino en API), imports ordenados, trailing commas.
