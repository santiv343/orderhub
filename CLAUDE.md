# Orderhub — Guía para el Agente IA

## Al iniciar cada sesión

1. Leer `docs/CONTEXT.md` — snapshot del estado actual (< 60 líneas, siempre fresco)
2. Si el usuario menciona tareas específicas, leer `docs/TASKS.md` para ver el detalle
3. Si hay decisiones de arquitectura en juego, leer `docs/ARCHITECTURE.md`

## Al completar trabajo en cada sesión

1. Actualizar `docs/CONTEXT.md` — reflejar qué se hizo y cuál es el próximo paso
2. Marcar tareas completadas en `docs/TASKS.md` (⏳ → ✅)
3. Si se tomó una decisión de arquitectura relevante → agregar entrada en `docs/ARCHITECTURE.md`
4. Si se diseñó un feature nuevo → crear spec en `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`

## Estructura de documentación

```
CLAUDE.md                        ← este archivo, cargado automático
docs/
├── CONTEXT.md                   ← snapshot rápido del estado actual (leer siempre)
├── TASKS.md                     ← tracker detallado de tareas por sprint
├── ARCHITECTURE.md              ← decisiones de arquitectura permanentes
├── design/                      ← docs de diseño del producto (visión, MVP, UX, etc.)
│   ├── 10-alcance-mvp.md        ← sprints y definición del MVP
│   ├── 13-practicas-de-codigo.md← estándares de código completos
│   └── ...                      ← otros docs de diseño
└── superpowers/specs/           ← specs de diseño por feature
```

## Estándares de código

**Siempre aplicar `orderhub-code-standards` skill antes de escribir código nuevo.**

Resumen de reglas críticas:
- Sin `any` en TypeScript — sin excepciones
- Sin assertions defensivas — validar solo en boundaries externos (API input, env vars, formularios)
- Sin `process.env` directo — usar `ConfigService` (API) o `env.ts` (Web)
- Enums para todos los estados/roles/fuentes — nunca strings hardcodeados
- Repository pattern en API — services no tocan Prisma directamente
- React Hook Form + Zod + shadcn Form para todos los forms del frontend
- Dinero: `Decimal` en Prisma, nunca `Float`
- Fechas: UTC en DB, convertir a `location.timezone` solo en frontend
- Respuesta API: siempre `{ data: T }` o `{ error: { code, message } }`
- Early returns, funciones cortas (<20 líneas), no comentar lo obvio — comentar el porqué

## Stack del proyecto

- **API:** NestJS + Fastify, Prisma + PostgreSQL, JWT auth con cookies httpOnly
- **Web:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, React Query, Zustand
- **Types:** paquete compartido `@orderhub/types` con enums y tipos de dominio
- **Monorepo:** pnpm workspaces + Turborepo

## Convenciones

- Respuestas API exitosas: `{ data: T }`
- Errores API: `{ error: { code: string, message: string } }`
- Auth: cookies httpOnly — `access_token` (15m) + `refresh_token` (7d)
- Zona horaria: `America/Buenos_Aires` | Moneda: ARS por defecto
- Idioma del código: inglés | Idioma de comunicación con el usuario: español

## Reglas de trabajo

- **Siempre crear una rama feature antes de empezar cualquier trabajo de código**
  - `git checkout develop && git pull`
  - `git checkout -b feature/<nombre>` (o `refactor/<nombre>`, `fix/<nombre>`)
  - PR de la rama feature → develop al terminar
  - Nunca commitear directo en `develop` o `main`
- No iniciar Sprint 2+ sin completar el Refactor pre-Sprint 2
- Cada capa del refactor debe compilar antes de avanzar a la siguiente
- Actualizar `docs/CONTEXT.md` siempre al final de una sesión de trabajo
