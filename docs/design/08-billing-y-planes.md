# Billing y planes

## Modelo de negocio

**Freemium + por conector activo.**

El billing se gestiona a nivel `Organization`. Una suscripción cubre todos los locales de la marca.

---

## Planes

### Free
- 1 local
- Hasta 100 pedidos/mes
- Importación manual (CSV, formulario)
- Dashboard básico (ventas del día, pedidos, ticket promedio)
- Herramientas operativas básicas (calculadoras, meta diaria)
- Sin conectores automáticos

### Base — flat mensual
- Locales ilimitados
- Pedidos ilimitados
- Dashboard completo
- Reportes semanales y mensuales
- Exportación CSV / PDF
- Todos los roles y permisos
- Sin conectores automáticos

### Por conector — add-on sobre plan Base
- +$X/mes por cada conector activo
- Ejemplos: PedidosYa, Uber Eats, Rappi
- Se activa/desactiva desde el panel
- Facturado por `LocationConnector` activo

---

## Modelo en base de datos

```
Organization.plan: 'free' | 'base' | 'pro'

BusinessConnector (conector contratado a nivel org)
  organizationId
  connectorType
  isActive
  activeSince
  billingCycleStart
```

---

## Notas de implementación

- El plan se verifica en el backend en cada request relevante.
- Si un negocio excede el límite del plan free, recibe una notificación y puede hacer upgrade.
- Los conectores se pueden pausar sin perder la configuración.
- No se implementa en el MVP — el campo `plan` se guarda pero no se valida todavía.
- Al registrarse, todos los negocios comienzan en plan `free`.
