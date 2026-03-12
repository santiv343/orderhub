# Orderhub — Contexto de Sesión

_Última actualización: 2026-03-12_

---

## Sprint activo

**Sprint 2 — Órdenes y Productos** (pendiente de inicio)

## Estado actual

Refactor pre-Sprint 2 completado en su totalidad. El codebase está listo para comenzar features de negocio.

## Qué se hizo (Refactor pre-Sprint 2)

**Capa 1 — DX & Consistencia:**
- Eliminadas rutas duplicadas (`apps/web/src/app/auth/` y `dashboard/`)
- `en.json` completado con todas las claves de auth
- `LoginDto` password: `@MinLength(8)` alineado con RegisterDto
- `tx: any` → `Prisma.TransactionClient` en AuthService
- `NEXT_PUBLIC_API_URL` agregada a `.env.example`

**Capa 2 — API Architecture & Security:**
- `UserRepository` creado (`modules/auth/repositories/`)
- `AuthService` refactorizado para usar `UserRepository`
- `UserResponseDto` reemplaza `sanitizeUser` — no más exposición de campos internos
- Rate limiting: `@nestjs/throttler` con `ThrottlerGuard` global (5 login/min, 3 register/min)
- Refresh token rotation con theft detection (reuse revoca todos los tokens)
- `@fastify/helmet` para HTTP security headers
- Cookie `secure` condicional según NODE_ENV (via ConfigService)

**Capa 3 — Frontend:**
- `shadcn/ui` componentes instalados (button, input, label, card) — Tailwind v3 compatible
- `zustand` — auth store (`useAuthStore`) con user, setUser, clear
- `useAuth` hook — centraliza lógica de `/auth/me` + redirect + store sync
- `env.ts` — validación Zod de vars de entorno en build time
- `api.ts` — usa env.ts, agrega método `patch`
- Login/Register pages migradas a componentes shadcn
- Dashboard simplificado a `useAuth` hook

## Próximo paso inmediato

Comenzar **Sprint 2**: diseñar e implementar módulo de Órdenes (API + Web).
Ver tareas pendientes en `docs/TASKS.md` sección Sprint 2.

## Commits del refactor

- `2da9531` — fix: consistencia y deuda técnica menor (Capa 1)
- `c2a6bc3` — fix: eliminar casts any innecesarios y restaurar refresh token rotation
- `bcd9648` — refactor: repository pattern, response DTOs y seguridad en API (Capa 2)
- `7a658e8` — fix: registrar ThrottlerGuard y null guard en me()
- `177d95e` — refactor: shadcn/ui, Zustand, useAuth y mejoras de arquitectura en Web (Capa 3)
- `34fd5c9` — fix: limpiar dependencias, registrar tailwindcss-animate y documentar retry:false

## Decisiones recientes

- shadcn@latest (v4) es incompatible con Tailwind v3 → componentes implementados manualmente con clases Tailwind v3. Evaluar upgrade a Tailwind v4 en Sprint 2+.
- `shadcn form` component pendiente — los forms actuales usan react-hook-form + inputs directos (funciona, pero sin FormField/FormMessage de shadcn)
