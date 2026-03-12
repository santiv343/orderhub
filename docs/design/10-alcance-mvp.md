# Alcance MVP — Orderhub

## Objetivo del MVP

> Un comercio instala la extensión, la conecta a PedidosYa, y desde ese momento todos los pedidos entran automáticamente al sistema y se contabilizan. Sin configurar nada.

**Criterio de éxito:**
- Un pedido llega en PedidosYa → aparece en el dashboard en menos de 30 segundos
- El dashboard muestra: ventas del día, cantidad de pedidos, ticket promedio
- Si el backend se cae, ningún pedido se pierde
- Un usuario puede registrarse, configurar la extensión y tener el primer pedido importado en menos de 10 minutos

---

## Lo que incluye el MVP

| Área | Incluye |
|---|---|
| Auth | Registro, login, JWT |
| Organización | Crear organization + location en el registro |
| Importación | Endpoint de importación, deduplicación, API Keys |
| Extensión | Intercepción de requests, parser, cola offline, retry |
| Dashboard | Ventas del día, pedidos, ticket promedio, lista de pedidos |
| Config | Pantalla para generar y copiar API Key |

## Lo que NO incluye el MVP

- Comisiones, gastos, márgenes
- Catálogo de productos
- Cierre diario
- Herramientas operativas (calculadoras, comandas)
- Reportes
- Multi-local / multi-usuario
- Roles y permisos
- Billing
- Otros conectores

---

## Sprints

### Sprint 0 — Setup del proyecto (3-4 días)

**Objetivo:** monorepo funcional, base de datos corriendo, entornos configurados.

#### Tareas

**Monorepo**
- [x] Inicializar monorepo (pnpm workspaces)
- [x] Crear estructura: `apps/api`, `apps/web`, `extensions/pedidosya`, `packages/types`
- [x] Configurar TypeScript compartido
- [x] Configurar ESLint + Prettier

**Backend**
- [x] Setup NestJS en `apps/api`
- [x] Configurar Prisma + PostgreSQL
- [x] Crear base de datos de desarrollo
- [x] Variables de entorno (`.env.example`)
- [x] Health check endpoint `GET /health`

**Frontend**
- [x] Setup Next.js + Tailwind + shadcn/ui en `apps/web`
- [x] Estructura de carpetas (app router, components, lib)
- [x] Página placeholder

**Extensión**
- [x] Setup TypeScript + Vite en `extensions/pedidosya`
- [x] Manifest v3 básico
- [x] Build script funcional

**Tipos compartidos**
- [x] Crear `packages/types`
- [x] Definir `ImportedOrder` type
- [x] Exportar desde el package

**Definition of Done:**
- [x] `pnpm dev` levanta API y web
- [ ] `pnpm build:extension` genera la extensión instalable
- [ ] La extensión se puede cargar en Chrome sin errores

---

### Sprint 1 — Auth y estructura base (4-5 días)

**Objetivo:** un usuario puede registrarse, crear su negocio y loguearse.

#### Tareas

**Backend**
- [x] Migración: `User`, `Organization`, `Location`, `LocationUser`
- [x] `POST /auth/register` → crea User + Organization + Location
- [x] `POST /auth/login` → devuelve accessToken + refreshToken
- [x] `POST /auth/refresh`
- [x] `GET /auth/me`
- [x] Guards de autenticación (JWT Guard)
- [x] Validación de inputs (class-validator)
- [x] Hash de passwords (bcrypt)

**Frontend**
- [ ] Página de login
- [ ] Página de registro (nombre, email, password, nombre del negocio)
- [ ] Manejo de tokens (httpOnly cookie o localStorage)
- [ ] Redirección post-login al dashboard
- [ ] Manejo de errores de auth

**Definition of Done:**
- Un usuario puede registrarse y loguearse
- El token se renueva automáticamente
- Rutas protegidas redirigen al login si no hay sesión

---

### Sprint 2 — Importación de pedidos (5-6 días)

**Objetivo:** el backend puede recibir, validar y guardar pedidos de cualquier fuente.

#### Tareas

**Backend**
- [ ] Migración: `Order`, `OrderItem`, `LocationApiKey`
- [ ] `POST /integrations/orders/import` (autenticado con API Key)
- [ ] Validación del contrato `ImportedOrder`
- [ ] Deduplicación: `unique(locationId, source, externalOrderId)`
- [ ] Lógica: si el pedido ya existe → ignorar (respuesta 200, no error)
- [ ] `POST /api-keys` → generar nueva API Key
- [ ] `GET /api-keys` → listar keys activas
- [ ] `DELETE /api-keys/:id` → revocar key
- [ ] La key se muestra una sola vez — se guarda el hash

**Tests**
- [ ] Test: importar un pedido nuevo → se guarda correctamente
- [ ] Test: importar el mismo pedido dos veces → deduplicación funciona
- [ ] Test: pedido con campos opcionales vacíos → se guarda igual
- [ ] Test: API Key inválida → 401

**Definition of Done:**
- `POST /integrations/orders/import` con una API Key válida guarda el pedido
- El mismo pedido enviado dos veces no genera duplicados
- Un pedido con solo `source`, `externalOrderId` y `total` se guarda correctamente

---

### Sprint 3 — Extensión PedidosYa (6-7 días)

**Objetivo:** la extensión detecta pedidos en el panel de PedidosYa y los envía al backend automáticamente.

#### Tareas

**Intercepción de requests**
- [ ] `interceptor.ts`: override de `window.fetch` y `XMLHttpRequest`
- [ ] Loguear todos los requests al dominio de PedidosYa (para mapear la API)
- [ ] Identificar los endpoints que contienen datos de pedidos
- [ ] Documentar la estructura del response de pedidos

**Parser**
- [ ] `parser.ts`: transformar el response de PedidosYa al formato `ImportedOrder`
- [ ] Mapear campos: id, items, total, cliente, notas, método de pago
- [ ] Manejar campos faltantes sin romper

**Envío al backend**
- [ ] `api.ts`: función `sendOrder(order: ImportedOrder)`
- [ ] Leer API Key desde `chrome.storage.sync`
- [ ] `POST /integrations/orders/import` con Bearer token

**Cola offline y reintentos**
- [ ] `background.ts`: service worker
- [ ] Al detectar un pedido → guardar en `chrome.storage.local` como cola
- [ ] Intentar enviar → si falla → reintento con backoff (1s, 2s, 4s, 8s, 16s)
- [ ] Máximo 10 intentos → marcar como fallido, notificar
- [ ] Al éxito → eliminar de la cola
- [ ] Badge en el ícono con cantidad de pedidos pendientes

**UX de la extensión**
- [ ] Popup básico: estado de conexión (conectado / sin API Key / pendientes: N)
- [ ] Pantalla para ingresar la API Key
- [ ] Indicador de último pedido importado

**Definition of Done:**
- Con el panel de PedidosYa abierto, un pedido nuevo aparece en el backend en menos de 5 segundos
- Si el backend está caído, el pedido se guarda localmente y se reintenta
- El popup muestra cuántos pedidos están pendientes de sincronizar

---

### Sprint 4 — Dashboard básico (5-6 días)

**Objetivo:** el usuario puede ver sus pedidos y métricas del día.

#### Tareas

**Backend — endpoints del dashboard**
- [ ] `GET /dashboard/today` → ventas totales, cantidad de pedidos, ticket promedio
- [ ] `GET /orders?date=today` → lista de pedidos del día con paginación
- [ ] `GET /orders/:id` → detalle de un pedido con items

**Frontend — dashboard**
- [ ] Layout principal (sidebar/navbar, área de contenido)
- [ ] Página dashboard: tarjetas de métricas del día
  - Ventas del día
  - Cantidad de pedidos
  - Ticket promedio
- [ ] Lista de pedidos del día
  - Canal de origen (ícono)
  - Hora
  - Total
  - Estado
- [ ] Detalle de pedido (modal o página): items, notas, cliente
- [ ] Actualización automática cada 30 segundos (polling o WebSocket futuro)

**Frontend — configuración**
- [ ] Página `Settings → API Keys`
- [ ] Generar nueva API Key (mostrar una sola vez con botón copiar)
- [ ] Listar keys activas con label y fecha
- [ ] Revocar key

**Definition of Done:**
- El dashboard muestra ventas, pedidos y ticket promedio del día
- Los pedidos importados por la extensión aparecen en la lista
- El usuario puede generar una API Key y configurarla en la extensión

---

### Sprint 5 — QA, pulido y deploy (4-5 días)

**Objetivo:** el MVP está listo para ser usado por un comercio real.

#### Tareas

**QA end-to-end**
- [ ] Flujo completo: registro → configurar extensión → primer pedido → aparece en dashboard
- [ ] Probar con panel real de PedidosYa
- [ ] Probar cola offline (desconectar backend, enviar pedidos, reconectar)
- [ ] Probar en Chrome, Edge
- [ ] Probar en mobile (PWA básica)

**Error handling y edge cases**
- [ ] Errores de red en el frontend (toast de error, retry)
- [ ] Pedidos con datos incompletos (sin items, sin cliente)
- [ ] Sesión expirada → redirect a login
- [ ] API Key revocada → la extensión muestra error claro

**UX polish**
- [ ] Estados de carga en todas las vistas
- [ ] Estados vacíos (primer día sin pedidos → mensaje guía)
- [ ] Responsive en tablet y mobile
- [ ] Favicon, título de la app

**Deploy**
- [ ] Deploy backend (Railway / Render)
- [ ] Deploy frontend (Vercel)
- [ ] Variables de entorno de producción
- [ ] Base de datos de producción (PostgreSQL)
- [ ] HTTPS configurado

**Definition of Done (MVP completo):**
- [ ] Un usuario nuevo puede registrarse en menos de 2 minutos
- [ ] La extensión se configura en menos de 3 minutos
- [ ] El primer pedido importado aparece en el dashboard
- [ ] El sistema funciona si el backend se cae temporalmente
- [ ] Todo corre en producción con HTTPS

---

## Resumen de sprints

| Sprint | Objetivo | Duración estimada |
|---|---|---|
| 0 | Setup del proyecto | 3-4 días |
| 1 | Auth y estructura base | 4-5 días |
| 2 | Importación de pedidos | 5-6 días |
| 3 | Extensión PedidosYa | 6-7 días |
| 4 | Dashboard básico | 5-6 días |
| 5 | QA, pulido y deploy | 4-5 días |
| **Total** | | **~5-6 semanas** |

---

## Riesgos del MVP

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| PedidosYa cambia su API interna | Media | Intercepción flexible, parser adaptable |
| La estructura del request no es legible sin un pedido real | Alta | Primero explorar el DOM logueando requests en el panel |
| PedidosYa bloquea la extensión | Baja | Fallback a parseo de DOM |
| Datos de pedidos incompletos | Alta | Todos los campos opcionales excepto `total` |
