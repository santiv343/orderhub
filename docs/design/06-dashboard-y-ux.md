# Dashboard y UX

## Principio de UX

> El usuario no puede dudar con nada de lo que ve.

- Cada métrica muestra claramente si tiene datos completos o no.
- Si falta configuración para mostrar una métrica, se muestra qué hay que hacer para desbloquearla.
- Sin pantallas vacías confusas. Sin errores sin explicación.
- Nunca se muestra un número que no sea confiable sin advertirlo.

Ejemplos:
- Sin comisión configurada → la columna "Comisión" no aparece o muestra "—  Configurar"
- Sin costo de producto → margen muestra "—  Agregar costo al producto"
- Con datos parciales → "Margen estimado (X de Y productos tienen costo)"

---

## Vistas principales

### Dashboard del día

```
┌─────────────────────────────────────────────┐
│  Ventas del día          $84.500             │
│  Pedidos                 23                  │
│  Ticket promedio         $3.674              │
│  Comisión estimada       $25.350  (30%)      │
│  Gastos del día          $8.000              │
│  Ganancia estimada       $51.150             │
├─────────────────────────────────────────────┤
│  Meta diaria: $100.000   ████████░░  84%     │
└─────────────────────────────────────────────┘
```

### Lista de pedidos

- Filtros: por canal, por estado, por fecha
- Cada pedido muestra: canal, hora, total, estado
- Detalle del pedido: items, notas, ajustes, comisión calculada

### Ranking de productos

- Más vendidos (por cantidad)
- Más rentables (por margen — solo si tienen costo)
- Tendencia vs semana anterior

### Control de gastos

- Lista del día con categoría, monto, descripción
- Botón rápido "Agregar gasto"
- Totales por categoría

### Cierre diario

- Estado: `borrador` / `cerrado`
- Resumen: ventas, comisiones, gastos, ganancia
- Botón "Cerrar el día" (pide confirmación)
- Historial de cierres anteriores

### Reportes

- Vista semanal y mensual
- Comparativa entre períodos
- Por canal de venta
- Exportar a CSV / PDF

---

## Herramientas operativas

### Calculadora de comisión

```
Total del pedido:      $10.000
Comisión (%):          30%
─────────────────────────────
Neto recibido:         $7.000
Comisión descontada:   $3.000
```

### Calculadora de precio de venta

```
Costo del producto:    $2.000
Packaging:             $200
Comisión (%):          30%
Margen deseado (%):    20%
─────────────────────────────
Precio sugerido:       $3.857
```

### Meta diaria

```
Meta:     $100.000
Actual:   $84.500
Faltan:   $15.500
████████████████░░░░  84%
```

### Impresión de comandas

- Desde el detalle de un pedido, el usuario puede imprimir la comanda.
- Formato compacto para impresoras de tickets (80mm).
- Incluye: número de pedido, canal, items, notas, hora.
- También disponible como vista para mostrar en pantalla secundaria.

---

## Dispositivos

La app es **mobile-first** pero funciona en todos los dispositivos:

| Dispositivo | Uso esperado |
|---|---|
| PC táctil | Operación diaria desde el local |
| Tablet | Gestión y monitoreo |
| Mobile | El dueño revisa ventas desde cualquier lugar |

Es una **PWA** (Progressive Web App):
- Se instala en el celular sin pasar por la App Store
- Funciona con cache offline para las vistas principales
- Notificaciones push (futuro)

---

## Multi-local (vista Organization)

El dueño de la franquicia puede:
- Ver un dashboard consolidado de todos los locales
- Comparar performance entre locales
- Cambiar de local con un selector en el header
- Ver qué locales están activos en el día

---

## Notificaciones y alertas

- Pedidos pendientes de sincronizar (cola de la extensión)
- Cierre del día generado automáticamente
- Pedidos llegados después de un cierre bloqueado
- Productos sin costo (impacta el cálculo de margen)
- Meta diaria alcanzada
