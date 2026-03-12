# Spec: Refactor y Mejoras de Código — Orderhub

**Fecha:** 2026-03-12
**Estado:** Aprobado — pendiente de implementación
**Autor:** Claude Code (sesión de diseño con santi)

---

## Contexto

El proyecto está en Sprint 0/1. El scaffold del monorepo está completo con auth funcional, pero antes de construir features de negocio (Sprint 2: órdenes, productos, etc.) se decidió hacer un refactor profundo por capas para:

- Corregir inconsistencias y bugs menores detectados
- Establecer patrones de arquitectura que escalen
- Agregar seguridad real al módulo de auth
- Incorporar librerías que eviten reinventar la rueda

**Enfoque aprobado:** Refactor por capas (Capa 1 → 2 → 3), cada capa en un commit atómico. Sin restricciones de compatibilidad hacia atrás.

---

## Librerías a incorporar

### Ahora (este refactor)

| Librería | App | Para qué |
|----------|-----|----------|
| `shadcn/ui` + Radix UI | web | Componentes base accesibles (Button, Input, Form, Card, Dialog) — reemplaza inputs crudos en auth |
| `zustand` | web | UI state (sidebar, notificaciones, estado de sesión cliente) |
| `@nestjs/throttler` | api | Rate limiting en endpoints de auth |
| `@fastify/helmet` | api | HTTP security headers |

### Sprints futuros (documentado para referencia)

| Librería | Cuándo | Para qué |
|----------|--------|----------|
| `@tanstack/table` | Sprint 2 | Tablas con sorting, filtros, paginación para órdenes |
| `recharts` | Sprint reportes | Gráficos de ventas y cierres diarios |
| `@nestjs/swagger` | Sprint 2 | Auto-generar docs de API desde DTOs |
| `bullmq` | Sprint conectores | Queue para procesar órdenes entrantes (usa Redis ya configurado) |
| `socket.io` | Sprint real-time | Actualizaciones de órdenes en vivo |
| `resend` | Sprint email | Verificación de email, reset de contraseña (usa Mailpit en dev) |

---

## Capa 1 — DX & Consistencia

**Commit:** `fix: consistencia y deuda técnica menor (Capa 1)`

Correcciones de bajo riesgo que no tocan arquitectura:

### 1.1 Eliminar rutas duplicadas en Next.js
- Eliminar `apps/web/src/app/auth/` completo
- Eliminar `apps/web/src/app/dashboard/` completo
- Las rutas correctas viven en `(auth)/` y `(dashboard)/` (route groups)

### 1.2 Completar `en.json`
- Agregar todas las claves faltantes del objeto `auth`:
  `loginTitle`, `loginSubtitle`, `registerTitle`, `registerSubtitle`,
  `emailPlaceholder`, `passwordPlaceholder`, `firstName`, `lastName`,
  `businessName`, `businessNamePlaceholder`, `noAccount`, `hasAccount`, `errors`

### 1.3 Alinear validaciones en DTOs de auth
- `apps/api/src/modules/auth/dto/login.dto.ts`
- Cambiar `@MinLength(1)` → `@MinLength(8)` en password (igual que `RegisterDto`)

### 1.4 Tipar transacción de Prisma
- `apps/api/src/modules/auth/auth.service.ts`
- Cambiar `tx: any` → `tx: Prisma.TransactionClient`

### 1.5 Documentar variable de entorno faltante
- Agregar `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` a `.env.example`

---

## Capa 2 — Arquitectura y Seguridad de la API

**Commit:** `refactor: repository pattern, response DTOs y seguridad en API (Capa 2)`

### 2.1 Repository Pattern

Hoy `AuthService` mezcla lógica de negocio con acceso directo a Prisma. Se introduce una capa de repositorios:

```
apps/api/src/modules/auth/
├── repositories/
│   └── user.repository.ts    ← findByEmail, findById, create
├── auth.service.ts           ← solo lógica de auth (tokens, bcrypt, cookies)
└── auth.controller.ts        ← sin cambios
```

`UserRepository` se inyecta como provider en `AuthModule`. Cuando llegue `UserModule` en Sprint 2, el repositorio ya existe y es reutilizable.

### 2.2 Response DTOs

Los endpoints hoy pueden exponer campos del modelo Prisma (incluyendo `passwordHash`). Se agregan DTOs de respuesta explícitos:

```typescript
// apps/api/src/modules/auth/dto/auth-response.dto.ts
class UserResponseDto {
  id: string
  email: string
  firstName: string
  lastName: string
}

class AuthResponseDto {
  user: UserResponseDto
}
```

El `ResponseInterceptor` sigue envolviendo en `{data: ...}`. El shape es ahora conocido y tipado en ambos lados.

### 2.3 Seguridad

**Rate limiting** (`@nestjs/throttler`):
- 5 intentos por minuto en `POST /auth/login`
- 3 intentos por minuto en `POST /auth/register`
- Decorador `@Throttle()` en los endpoints específicos

**Refresh token rotation:**
- Al hacer `POST /auth/refresh`, el refresh token viejo se marca como `used: true` en DB
- Se emite un nuevo refresh token
- Si se intenta usar un token ya usado → revocar todos los tokens activos del usuario (detección de robo)

**HTTP security headers:**
- `@fastify/helmet` registrado en `main.ts`

**Cookie `secure` condicional:**
```typescript
secure: configService.get('NODE_ENV') === 'production'
```

### 2.4 Centralizar acceso a configuración

Reemplazar referencias directas a `process.env.JWT_SECRET` etc. con `ConfigService` de NestJS en todos los lugares donde se use fuera del módulo de config.

---

## Capa 3 — Refactor del Frontend

**Commit:** `refactor: shadcn/ui, Zustand, useAuth y mejoras de arquitectura en Web (Capa 3)`

### 3.1 Setup shadcn/ui

- Inicializar shadcn/ui en `apps/web`
- Instalar componentes base: `button`, `input`, `form`, `card`, `label`
- Reemplazar inputs y botones crudos en páginas de login y register con componentes shadcn

### 3.2 Zustand store de auth

```typescript
// apps/web/src/stores/auth.store.ts
interface AuthStore {
  user: UserResponseDto | null
  setUser: (user: UserResponseDto | null) => void
  clear: () => void
}
```

El store se hidrata con la respuesta del login/register y se limpia en logout.

### 3.3 Hook `useAuth`

```typescript
// apps/web/src/hooks/use-auth.ts
export function useAuth() {
  // Lee del Zustand store primero (sin fetch)
  // Si no hay user, hace GET /auth/me con React Query
  // Si error 401 → redirect a /auth/login
  // Retorna: { user, isLoading }
}
```

El Dashboard y cualquier página protegida futura usan `useAuth()`. La lógica no se reimplementa por página.

### 3.4 Mejorar API client

```typescript
// apps/web/src/lib/api.ts
// - baseURL desde env.NEXT_PUBLIC_API_URL (validado en build)
// - Separar función interna de unwrap de {data: T}
// - Manejo explícito de 401 (limpiar store + redirect)
```

La interfaz pública de `api.get/post/delete` no cambia — solo los internals y la configuración.

### 3.5 Validación de variables de entorno en build

```typescript
// apps/web/src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
})
```

Si falta una variable, el build falla con error claro en lugar de `undefined` silencioso.

### 3.6 Directorio `src/hooks/` como canónico

- Crear `apps/web/src/hooks/` como directorio para todos los hooks de React Query y Zustand
- `use-auth.ts` es el primer hook
- Las páginas quedan como componentes "tontos" que solo renderizan

---

## Consideraciones de testing

No se escriben tests en este refactor (no hay setup de Jest/Vitest todavía). Los tests son trabajo del Sprint 2+. Lo que sí se hace en Capa 2: los repositorios están diseñados para ser fácilmente mockeables en el futuro (constructor injection).

---

## Orden de ejecución

```
Capa 1 (30 min) → Capa 2 (90 min) → Capa 3 (90 min)
```

Cada capa debe compilar y funcionar antes de avanzar a la siguiente.
