# Roadmap de desarrollo

## Fase 1 — MVP: Zero config, full value

**Objetivo:** Un comercio instala la extensión, conecta PedidosYa y empieza a contabilizar pedidos automáticamente sin configurar nada.

### Backend
- [x] Setup monorepo (NestJS + Prisma + PostgreSQL)
- [x] Modelo de datos base (Organization, Location, User, Order, OrderItem)
- [ ] Auth (register, login, JWT)
- [ ] Endpoint `POST /integrations/orders/import`
- [ ] Deduplicación por `(locationId, source, externalOrderId)`
- [ ] API Keys para conectores

### Extensión PedidosYa
- [x] Setup (TypeScript + Vite + Manifest v3)
- [ ] Intercepción de requests fetch/XHR
- [ ] Parser de pedidos al formato `ImportedOrder`
- [ ] Envío al backend con API Key
- [ ] Cola local con reintentos (chrome.storage + backoff)
- [ ] Badge con pedidos pendientes

### Frontend
- [x] Setup Next.js + Tailwind + shadcn/ui + PWA
- [ ] Login / registro
- [ ] Dashboard del día (ventas, pedidos, ticket promedio)
- [ ] Lista de pedidos del día
- [ ] Configuración de API Key para la extensión

---

## Fase 2 — Inteligencia básica

- [ ] Configuración de comisión por canal → comisión estimada en dashboard
- [ ] Registro de gastos del día
- [ ] Cierre diario automático (draft) + lock manual
- [ ] Meta diaria
- [ ] Herramientas: calculadora de comisión, calculadora de precio
- [ ] Impresión de comandas
- [ ] Exportación CSV

---

## Fase 3 — Catálogo simple

- [ ] Gestión de productos (nombre, precio, costo)
- [ ] Mapeo de items de pedidos al catálogo (ProductMapping)
- [ ] Margen estimado en dashboard (donde hay datos)
- [ ] Ranking de productos
- [ ] Aviso cuando faltan costos

---

## Fase 4 — Reportes y multi-local

- [ ] Reportes semanales y mensuales
- [ ] Comparativa entre períodos
- [ ] Vista Organization (consolidado de locales)
- [ ] Gestión de empleados por local (roles)
- [ ] Exportación PDF

---

## Fase 5 — Catálogo avanzado

- [ ] Variantes de productos
- [ ] Modificadores
- [ ] Stock básico
- [ ] Catálogo template a nivel Organization
- [ ] Override de precios por local

---

## Fase 6 — Nuevos conectores

- [ ] Conector Uber Eats (mismo patrón que PedidosYa)
- [ ] Conector Rappi
- [ ] Importación CSV genérica
- [ ] Pedido manual desde el dashboard

---

## Fase 7 — Producto

- [ ] Billing y planes (Freemium + por conector)
- [ ] Onboarding guiado
- [ ] Chrome Web Store
- [ ] Notificaciones push (PWA)
- [ ] API pública para integraciones futuras
