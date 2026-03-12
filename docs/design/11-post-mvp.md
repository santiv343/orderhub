# Post MVP — Orderhub

Todo lo que viene después del MVP, organizado por fases de valor.
Cada fase agrega inteligencia sin romper lo anterior.

---

## Fase 2 — Inteligencia del negocio

**Objetivo:** el comercio empieza a entender su rentabilidad.

### Comisiones por canal
- [ ] Configurar `commissionRate` en `LocationConnector`
- [ ] Calcular comisión estimada por pedido
- [ ] Mostrar en dashboard: comisión total del día
- [ ] Mostrar en detalle de pedido: neto recibido

### Gastos del día
- [ ] Migración: `Expense`, `ExpenseCategory`
- [ ] Categorías del sistema predefinidas (Insumos, Packaging, Personal, etc.)
- [ ] CRUD de categorías custom por location
- [ ] `POST /expenses` → registrar gasto
- [ ] `GET /expenses?date=today` → gastos del día
- [ ] Botón flotante de acceso rápido en el dashboard
- [ ] Total de gastos en el dashboard del día

### Cierre diario
- [ ] Migración: `DailyClose`
- [ ] Cron job a medianoche → generar cierre en estado `draft`
- [ ] El draft se actualiza automáticamente con nuevos pedidos del día
- [ ] `POST /daily-close/:date/lock` → el usuario bloquea el cierre
- [ ] El cierre locked es inmutable
- [ ] Si llegan pedidos para un día ya locked → notificación de discrepancia
- [ ] Vista de cierre diario en el frontend
- [ ] Historial de cierres

### Meta diaria
- [ ] Configurar meta ($X de ventas por día)
- [ ] Barra de progreso en el dashboard
- [ ] Proyección basada en ritmo actual
- [ ] Alerta cuando se alcanza la meta

### Costos por canal (adicionales)
- [ ] `packagingCostPerOrder` en `LocationConnector`
- [ ] `otherFixedCostPerOrder` en `LocationConnector`
- [ ] Incluir en cálculo de ganancia estimada

---

## Fase 3 — Herramientas operativas

**Objetivo:** todo lo que el comercio necesita a mano, sin salir de la app.

### Calculadora de comisión
- [ ] Input: total del pedido + porcentaje
- [ ] Output: neto recibido + comisión descontada
- [ ] Opción de usar porcentaje del canal configurado

### Calculadora de precio de venta
- [ ] Input: costo + packaging + comisión (%) + margen deseado (%)
- [ ] Output: precio sugerido + desglose

### Impresión de comandas
- [ ] Vista de comanda desde el detalle de un pedido
- [ ] Formato impresora de tickets 80mm (CSS print)
- [ ] Vista en pantalla para tablet de cocina
- [ ] Contenido: canal, hora, items, notas, cliente

### Registro manual de pedido
- [ ] Formulario: canal, items, total, notas, método de pago
- [ ] Flujo rápido (mínimo de pasos)

### Resumen rápido del turno
- [ ] Vista compacta: pedidos, ventas, pendientes de sincronizar
- [ ] Accesible desde la extensión y desde el dashboard

---

## Fase 4 — Catálogo simple

**Objetivo:** el comercio empieza a ver margen real.

### Gestión de productos
- [ ] Migración: `LocationProduct`
- [ ] CRUD de productos (nombre, precio, costo)
- [ ] Activar / desactivar producto
- [ ] Importar desde CSV

### Mapeo de productos
- [ ] Migración: `ProductMapping`
- [ ] Vista "Pendientes de mapear" → items sin asociar al catálogo
- [ ] El usuario mapea un nombre externo a un producto
- [ ] El mapeo se guarda y aplica automáticamente a futuros pedidos

### Margen en el dashboard
- [ ] Margen real cuando el producto tiene costo
- [ ] Mostrar "—" cuando no hay costo
- [ ] Aviso: "X productos sin costo. El margen puede estar incompleto."
- [ ] Ranking de productos (más vendidos, más rentables)

---

## Fase 5 — Reportes

**Objetivo:** el comercio puede analizar su negocio en el tiempo.

### Reportes básicos
- [ ] Vista semanal: ventas, pedidos, ticket promedio, comisiones, gastos
- [ ] Vista mensual: mismo desglose
- [ ] Comparativa con período anterior
- [ ] Desglose por canal de venta

### Exportación
- [ ] Exportar pedidos a CSV (filtros: fecha, canal, estado)
- [ ] Exportar cierre diario a PDF
- [ ] Exportar reporte mensual a PDF

---

## Fase 6 — Multi-usuario y roles

**Objetivo:** el comercio puede tener empleados con accesos diferenciados.

### Gestión de usuarios por local
- [ ] Migración: `LocationUser` con roles
- [ ] Invitar empleado por email
- [ ] Roles: manager / operator / viewer
- [ ] Tabla de permisos por rol (ver modelo de seguridad)
- [ ] Revocar acceso

### Gestión a nivel organización
- [ ] `OrganizationUser` con roles: owner / admin
- [ ] Vista consolidada de todos los locales
- [ ] Dashboard comparativo entre locales

---

## Fase 7 — Multi-local

**Objetivo:** una franquicia puede gestionar todos sus locales desde una sola cuenta.

- [ ] Crear múltiples locations desde el panel
- [ ] Selector de local activo en el header
- [ ] Dashboard consolidado de la organización
- [ ] Catálogo template a nivel organización (`OrganizationProduct`)
- [ ] Los locales pueden heredar del template o crear productos propios
- [ ] Reportes por local y comparativos

---

## Fase 8 — Catálogo avanzado

**Objetivo:** el comercio puede gestionar su menú completo con variantes y modificadores.

- [ ] Migración: `LocationProductVariant`
- [ ] Variantes (Chico, Mediano, Grande) con precio y costo propio
- [ ] Modificadores / opciones (tipo de leche, sin azúcar, etc.)
- [ ] Modificadores con costo adicional
- [ ] Mapeo de pedidos con variantes al catálogo
- [ ] Stock básico (decrementa con cada pedido)
- [ ] Alerta de stock bajo

---

## Fase 9 — Nuevos conectores

### Conector Uber Eats
- [ ] Chrome Extension (mismo patrón que PedidosYa)
- [ ] Investigar estructura de requests de Uber Eats Merchant
- [ ] Parser específico
- [ ] Reglas de negocio de Uber Eats (cancelaciones, comisiones)

### Conector Rappi
- [ ] Chrome Extension
- [ ] Parser específico

### Importación CSV genérica
- [ ] Definir formato estándar de CSV
- [ ] Upload desde el dashboard
- [ ] Parser + preview antes de importar
- [ ] Mapeo de columnas

---

## Fase 10 — Billing y planes

- [ ] Implementar validación de plan en el backend
- [ ] Límite de 100 pedidos/mes en plan free
- [ ] Restricción de conectores según plan
- [ ] Integración con pasarela de pagos (Stripe u otro)
- [ ] Portal de billing en el dashboard
- [ ] Emails transaccionales (bienvenida, límite alcanzado, factura)
- [ ] Upgrade / downgrade de plan

---

## Fase 11 — Seguridad avanzada

### 2FA con app autenticadora
- [ ] Integrar TOTP (Time-based One-Time Password) — compatible con Google Authenticator, Authy, etc.
- [ ] Migración: `User.twoFactorSecret` (nullable), `User.twoFactorEnabled`
- [ ] Flujo de activación: escanear QR → confirmar con código → activar
- [ ] Flujo de login: usuario + password → si 2FA activo → pedir código TOTP
- [ ] Códigos de recuperación (backup codes) en caso de perder el dispositivo
- [ ] Opción de desactivar 2FA (requiere confirmar con código)

---

## Fase 13 — Producto y distribución

- [ ] Onboarding guiado (wizard de primeros pasos)
- [ ] Chrome Web Store (publicar extensión)
- [ ] PWA completa (push notifications, instalación en mobile)
- [ ] Landing page pública
- [ ] Documentación para usuarios
- [ ] Sistema de soporte básico
- [ ] Métricas de uso (analytics internos)

---

## Backlog sin fase asignada

Ideas a evaluar, sin compromiso de implementación:

- Conversor de unidades (gramos, kg, litros — útil para insumos)
- Calculadora de recetas (costo por porción desde ingredientes)
- Recordatorios operativos (ej. "pedir insumos los lunes")
- Notas del día / novedades del turno
- Integración con sistemas de facturación electrónica
- API pública de Orderhub para integraciones externas
- App mobile nativa (si la PWA no es suficiente)
- Modo offline completo (para locales con conectividad inestable)
- Historial de precios de productos
- Gestión de proveedores
- Registro de compras de insumos
- Análisis de estacionalidad (productos que venden más en ciertos días/horarios)
