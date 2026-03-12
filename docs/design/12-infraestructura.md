# Infraestructura

## Entornos

| Entorno | Descripción | VPS | Base de datos |
|---|---|---|---|
| `development` | Local en WSL2, Docker para infra | — | PostgreSQL local (Docker) |
| `staging` | VPS Hetzner separado, rama `develop` | CX11 (~€3/mes) | `orderhub_staging` — snapshot de producción |
| `production` | VPS Hetzner, rama `main` | CX22 (~€4/mes) | `orderhub_prod` |

**Staging usa un snapshot de la base de datos de producción**, restaurado periódicamente. Esto permite testear con datos reales sin ningún riesgo de tocar producción.

Flujo de refresh de staging:
```
pg_dump orderhub_prod → anonimizar datos sensibles (emails, passwords) → pg_restore orderhub_staging
```

- Datos reales para testear comportamientos reales
- Sin riesgo de escrituras que afecten prod
- Datos sensibles anonimizados en el proceso
- Se puede refrescar cuando se necesite (manualmente o con cron semanal)

Las migraciones de Prisma se prueban primero en staging antes de correrlas en producción.

---

## Desarrollo local

**Requisito:** todo el código y herramientas viven dentro de WSL2 (Ubuntu).
Esto garantiza hot reload nativo, file watching correcto y paridad con producción.

```
WSL2 (Ubuntu)
├── ~/projects/orderhub/   ← código fuente
├── Node.js + pnpm         ← instalados en WSL2, no en Windows
├── Git                    ← instalado en WSL2
└── VS Code Remote WSL     ← extensión para editar desde Windows
```

### docker-compose.dev.yml

Solo infraestructura. Los servidores de desarrollo corren nativos.

```yaml
services:
  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: orderhub_dev
      POSTGRES_USER: orderhub
      POSTGRES_PASSWORD: orderhub
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # UI web para ver emails

  localstack:
    image: localstack/localstack
    ports: ["4566:4566"]
    environment:
      SERVICES: s3
      DEFAULT_REGION: us-east-1
    volumes:
      - localstack_data:/var/lib/localstack

volumes:
  postgres_data:
  localstack_data:
```

### Arranque del día

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm dev
```

---

## Producción — VPS Hetzner

**Servidor:** Hetzner CX22 (~€4/mes)
**OS:** Ubuntu 24.04 LTS
**Docker:** Docker + Docker Compose

### Servicios en producción

```yaml
# docker-compose.prod.yml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - certbot_data:/etc/letsencrypt

  api:
    image: ghcr.io/org/orderhub-api:latest
    env_file: .env
    depends_on: [db, redis]
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    env_file: .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backup:
    image: ghcr.io/org/orderhub-backup:latest
    env_file: .env
    volumes:
      - postgres_data:/var/lib/postgresql/data:ro
    # Cron: backup diario a S3/Backblaze
```

**Frontend:** Vercel (Next.js, free tier, CDN global, SSL automático)

### SSL

Let's Encrypt via Certbot. Renovación automática con cron.

---

## Backups

### Local (desarrollo)

LocalStack simula S3. Mismo código que producción, distinta URL.

```
STORAGE_ENDPOINT=http://localhost:4566
STORAGE_BUCKET=orderhub-backups
```

### Producción

Backblaze B2 (compatible con S3, mucho más barato).

```
STORAGE_ENDPOINT=https://s3.us-west-001.backblazeb2.com
STORAGE_BUCKET=orderhub-backups
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
```

**Estrategia:**
- Backup completo de PostgreSQL cada 24hs
- Retención: 30 días
- El cron corre dentro del contenedor `backup`
- Notificación por email si el backup falla

---

## Email

### Desarrollo

Mailpit — SMTP local con UI web en `http://localhost:8025`.
Los emails no salen a internet, se capturan localmente.

```
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@orderhub.local
```

### Producción

SMTP genérico. Se configura en `.env` sin cambiar código.
Compatible con cualquier proveedor: Gmail, Resend, Brevo, SES, etc.

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@orderhub.app
```

---

## Variables de entorno

Nunca se usan `process.env` directamente en el código.
Todo pasa por `src/config/config.ts` con validación Zod al arrancar.

Si falta una variable requerida, la app no arranca y loguea qué falta.

`.env.example` vive en el repo con todas las variables documentadas pero sin valores.
`.env` nunca se commitea.

---

## Secrets en producción

Por ahora: archivo `.env` en el VPS, fuera del repo, permisos `600`.
Futuro: migrar a Docker secrets o un vault si el equipo crece.

---

## CI/CD — GitHub Actions

### Flujo

```
Push a develop → deploy a staging
Push a main    → deploy a producción
```

### Pipeline

```yaml
# .github/workflows/deploy.yml
jobs:
  test:
    - pnpm install
    - pnpm turbo test
    - pnpm turbo build

  deploy:
    needs: test
    - Build Docker image
    - Push a GitHub Container Registry (ghcr.io)
    - SSH al VPS
    - docker compose pull
    - prisma migrate deploy   ← migraciones automáticas
    - docker compose up -d
```

### Extensión Chrome — auto-update

La extensión incluye `update_url` apuntando al backend.
El CI/CD también:
1. Empaqueta la extensión (`.crx`)
2. Genera `updates.xml` con la nueva versión
3. Los sube al storage
4. Chrome verifica y descarga la actualización automáticamente

---

## Logging

**Librería:** Pino (NestJS)

| Entorno | Output |
|---|---|
| `development` | stdout, formato pretty (legible) |
| `production` | archivo `/var/log/orderhub/api.log`, formato JSON |

Rotación de logs: logrotate diario, retención 14 días.

Los logs incluyen siempre: `timestamp`, `level`, `requestId`, `locationId` (cuando aplica).

---

## Error tracking

**Sentry** (free tier)
- Integrado en NestJS (backend) y Next.js (frontend)
- Captura excepciones no manejadas
- Alertas por email en errores críticos
- `SENTRY_DSN` en variables de entorno

---

## Monitoreo de uptime

UptimeRobot (free tier) — ping cada 5 minutos al `GET /health`.
Alerta por email si el servicio cae.

---

## Redis — usos definidos

| Uso | Descripción |
|---|---|
| Rate limiting | Contadores por API Key e IP |
| Caché de métricas | Dashboard del día cacheado (TTL corto, ej. 30s) |
| Refresh tokens | Set de tokens revocados para validación rápida |
| Job queue | Cron de cierres diarios por timezone de cada Location |
| SSE connections | Estado de conexiones activas |

---

## Deployments a producción

Los deploys a producción se realizan en horarios acordados previamente (fuera del horario operativo del negocio). No se requiere zero-downtime para el MVP.

Flujo:
1. Deploy y validación en staging
2. Acuerdo con el equipo del horario de deploy
3. `docker compose pull && docker compose up -d` en producción
4. `prisma migrate deploy` automático en el pipeline

---

## Resumen de servicios por entorno

| Servicio | Dev (local) | Staging | Producción |
|---|---|---|---|
| API | `pnpm dev` nativo | Docker (VPS) | Docker (VPS) |
| Web | `pnpm dev` nativo | Vercel | Vercel |
| PostgreSQL | Docker local | Docker (VPS) | Docker (VPS) |
| Redis | Docker local | Docker (VPS) | Docker (VPS) |
| Email | Mailpit (Docker) | SMTP real | SMTP real |
| Storage/S3 | LocalStack (Docker) | Backblaze B2 | Backblaze B2 |
| Logs | stdout | Archivo | Archivo |
| Error tracking | Deshabilitado | Sentry | Sentry |
