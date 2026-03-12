# Modelo de datos

## Jerarquía organizacional

```
Organization  (marca / franquicia)
    └── Location  (local / sucursal)
            ├── LocationUser  (empleados del local)
            ├── LocationConnector  (PedidosYa, Uber Eats, etc.)
            ├── LocationProduct  (catálogo del local)
            ├── Order  (pedidos)
            ├── Expense  (gastos)
            └── DailyClose  (cierre diario)
```

---

## Entidades

### Organization
```
id
name
plan: 'free' | 'base' | 'pro'
billingEmail
createdAt
```

### Location
```
id
organizationId
name
address
timezone
currency
taxEnabled
taxRate (nullable)
isActive
createdAt
```

### User
```
id
email
passwordHash
name
createdAt
```

### OrganizationUser  ← acceso a nivel marca
```
userId
organizationId
role: 'owner' | 'admin'
```
> Ve todos los locales. Reportes consolidados. Gestión de billing.

### LocationUser  ← acceso a nivel local
```
userId
locationId
role: 'manager' | 'operator' | 'viewer'
```

---

## Pedidos

### Order
```
id
locationId
source: 'pedidosya' | 'ubereats' | 'rappi' | 'manual' | 'whatsapp' | 'csv'
externalOrderId (nullable)
status: 'created' | 'confirmed' | 'delivered' | 'cancelled' | 'refunded' | 'partial_refund'
cancellationReason: 'platform' | 'customer' | 'seller' | null
hadCostOnCancel: boolean
paymentMethod (nullable)
customerName (nullable)
notes (nullable)
subtotal Decimal? (nullable)
discount Decimal? (nullable)
deliveryFee Decimal? (nullable)
total Decimal
commissionRateSnapshot Decimal? ← comisión vigente al momento de importar, nunca recalcula
createdAt
capturedAt
```

**Ciclo de vida por origen:**
```
Pedido de plataforma (PedidosYa, Uber Eats...):
  llega como confirmed (ya fue aceptado en la plataforma)
  confirmed → delivered
  confirmed → cancelled / refunded / partial_refund

Pedido manual (WhatsApp, mostrador, CSV):
  created → confirmed → delivered
  created → cancelled (rechazado antes de confirmar)
```

**Regla de comisiones:** al capturar un pedido, se copia el `commissionRate` actual del `LocationConnector` en `commissionRateSnapshot`. Si el rate cambia en el futuro, los pedidos históricos conservan el rate original. Si no había rate configurado, queda `null`.

**Qué cuenta como venta en métricas:**
- `confirmed` → suma total completo
- `delivered` → suma total completo
- `partial_refund` → suma (total − monto del ajuste en OrderAdjustment)
- `cancelled` → no suma. Si `hadCostOnCancel = true` → pérdida registrada como gasto
- `refunded` → no suma
- `created` → no suma (aún no confirmado)

### OrderItem
```
id
orderId
name                ← nombre tal como vino de la plataforma
quantity
price (nullable)
productId (nullable) ← link al catálogo, opcional
```

### OrderAdjustment
```
id
orderId
type: 'refund' | 'loss' | 'discount' | 'correction'
amount
reason
createdAt
```

**Deduplicación:** `unique(locationId, source, externalOrderId)`

---

## Catálogo de productos

### OrganizationProduct  ← plantilla opcional a nivel marca
```
id
organizationId
name
baseCost (nullable)
basePrice (nullable)
isActive
```

### LocationProduct  ← catálogo real del local
```
id
locationId
name
cost (nullable)
price (nullable)
isActive
organizationProductId (nullable)  ← referencia al template, si aplica
```

### LocationProductVariant  ← opcional (nivel avanzado)
```
id
locationProductId
name
priceModifier
costModifier
```

### ProductLocationPrice  ← override de precio por local (desde template)
```
productId     ← OrganizationProduct
locationId
price
cost
```

### ProductMapping  ← normalización de nombres externos
```
id
locationId
externalName    ← "Latte Grande c/ avena" (como viene de la plataforma)
channelId
locationProductId
```

---

## Conectores

### LocationConnector
```
id
locationId
connectorType: 'pedidosya' | 'ubereats' | 'rappi' | 'csv' | 'manual'
commissionRate (nullable)
packagingCostPerOrder (nullable)
otherFixedCostPerOrder (nullable)
config (JSON — settings específicos del conector)
isActive
```

---

## Gastos

### ExpenseCategory
```
id
locationId
name
isSystem: boolean   ← true = categoría predefinida, false = creada por el usuario
```

Categorías predefinidas del sistema:
- Insumos
- Packaging
- Personal
- Servicios / Utilities
- Equipamiento
- Alquiler
- Pérdida
- Otro

### Expense
```
id
locationId
date
categoryId
amount
description (nullable)
isRecurring: boolean
createdAt
```

---

## Cierre diario

### DailyClose
```
id
locationId
date
status: 'draft' | 'locked'
totalSales
totalOrders
averageTicket
totalCommissions (nullable)
totalExpenses
estimatedProfit (nullable)
lockedAt (nullable)
lockedBy (userId, nullable)
createdAt
```

> El cierre se genera automáticamente a medianoche como `draft`.
> Mientras esté en `draft`, se actualiza con nuevos pedidos del día.
> El usuario lo bloquea manualmente. Una vez `locked`, es inmutable.
> Pedidos que llegan después del lock quedan marcados y generan una notificación.

---

## Auth

### RefreshToken
```
id
userId
tokenHash
expiresAt      ← 7 días
revokedAt (nullable)
replacedById (nullable)  ← referencia al nuevo token emitido en la rotation
createdAt
```

Rotation obligatoria: cada uso del refresh token lo revoca y emite uno nuevo.
Al cambiar contraseña, todos los refresh tokens del usuario se revocan.

### EmailVerificationToken
```
id
userId
tokenHash
expiresAt      ← 24 horas
usedAt (nullable)
createdAt
```

Verificación obligatoria al registrarse. Sin email verificado, acceso denegado.

### PasswordResetToken
```
id
userId
tokenHash
expiresAt      ← 1 hora
usedAt (nullable)
createdAt
```

Un solo uso. Al usarlo se marca `usedAt` y se revocan todos los refresh tokens activos del usuario.

---

## Preferencias de usuario

### UserPreference
```
userId (unique)
selectedLocationId (nullable)  ← location activa en el dashboard
language: 'es' | 'en'
updatedAt
```

Todo el estado del usuario se guarda en DB. Así el usuario puede acceder desde distintos dispositivos con la misma configuración.

---

## Auditoría

### AuditLog
```
id
locationId
entityType
entityId
action: 'create' | 'update' | 'delete' | 'lock'
userId
timestamp
diff (JSON)
```

> Todos los registros financieros usan soft delete (`deletedAt`), nunca hard delete.
