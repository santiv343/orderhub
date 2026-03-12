# Orderhub — Documentación

Plataforma de operaciones para negocios que venden a través de plataformas de delivery y canales propios.

---

## Índice

| # | Documento | Descripción |
|---|---|---|
| 01 | [Visión del producto](./01-vision.md) | Qué es, qué problema resuelve, principio de diseño central |
| 02 | [Arquitectura](./02-arquitectura.md) | Capas del sistema, stack tecnológico, estructura del monorepo |
| 03 | [Modelo de datos](./03-modelo-de-datos.md) | Schema completo: entidades, relaciones, decisiones de diseño |
| 04 | [Conectores](./04-conectores.md) | Cómo funcionan los conectores, extensión PedidosYa, contrato ImportedOrder |
| 05 | [Seguridad y auth](./05-seguridad-y-auth.md) | JWT, API Keys, roles y permisos, aislamiento de datos |
| 06 | [Dashboard y UX](./06-dashboard-y-ux.md) | Vistas principales, principios de UX, dispositivos |
| 07 | [Herramientas operativas](./07-herramientas-operativas.md) | Calculadoras, comandas, registro rápido, herramientas del día a día |
| 08 | [Billing y planes](./08-billing-y-planes.md) | Freemium, planes, modelo por conector |
| 09 | [Roadmap](./09-roadmap.md) | Fases de desarrollo, prioridades |
| 10 | [Alcance MVP](./10-alcance-mvp.md) | Sprints, tareas y criterios de éxito del MVP |
| 11 | [Post MVP](./11-post-mvp.md) | Todo lo que viene después del MVP, por fases |

---

## Principio de diseño central

> **Zero config, full value desde el día uno.**
>
> El sistema funciona sin catálogo, sin comisiones configuradas, sin productos cargados.
> Cada configuración adicional desbloquea más inteligencia, pero nunca es un requisito.
> Desde un emprendimiento de 2 personas hasta una franquicia con múltiples locales.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS + PostgreSQL + Prisma |
| Frontend | Next.js + Tailwind + shadcn/ui (PWA) |
| Extensión | TypeScript + Vite + Chrome Manifest v3 |

---

## Estado actual

Diseño cerrado. Listo para iniciar desarrollo — Sprint 0.
