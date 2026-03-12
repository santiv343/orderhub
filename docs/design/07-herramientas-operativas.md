# Herramientas operativas

Orderhub no es solo un sistema de registro. También centraliza las herramientas del día a día que un comercio necesita tener a mano.

Todo accesible desde el dashboard, sin tener que salir de la app.

---

## Calculadora de comisión

Para calcular rápidamente el neto de un pedido.

**Inputs:**
- Total del pedido
- Porcentaje de comisión

**Outputs:**
- Comisión descontada
- Neto recibido

**Extra:** puede tomar el porcentaje del canal configurado automáticamente.

---

## Calculadora de precio de venta

Para definir el precio correcto de un producto.

**Inputs:**
- Costo de producción
- Costo de packaging
- Comisión del canal (%)
- Margen deseado (%)

**Output:**
- Precio de venta sugerido
- Desglose: costo + packaging + comisión + margen

---

## Impresión de comandas

Desde el detalle de cualquier pedido, el usuario puede imprimir o mostrar la comanda.

**Formatos:**
- Impresión física (optimizado para impresoras de tickets 80mm)
- Vista en pantalla (para mostrar en pantalla secundaria o tablet de cocina)

**Contenido de la comanda:**
- Número de pedido
- Canal de origen (PedidosYa, Uber Eats, manual, etc.)
- Hora del pedido
- Items con cantidad y modificadores/notas
- Notas generales del pedido
- Cliente (si está disponible)

---

## Meta diaria

El usuario define una meta de ventas para el día.

```
Meta:     $100.000
Actual:   $84.500
Faltan:   $15.500
Progreso: 84%  ████████████████░░░░
```

- La meta puede ser fija (siempre la misma) o configurarse por día.
- Muestra proyección estimada basada en el ritmo actual del día.
- Alerta cuando se alcanza la meta.

---

## Resumen rápido del turno

Vista compacta para el operador que necesita ver el estado actual sin entrar al dashboard completo.

```
Turno actual (desde 09:00)
Pedidos:   18
Ventas:    $62.400
Pendiente de importar: 0
```

---

## Registro rápido de gasto

Desde cualquier vista, el usuario puede registrar un gasto en dos toques:

1. Botón flotante "+" → "Registrar gasto"
2. Categoría + monto + descripción opcional → Guardar

---

## Registro manual de pedido

Para pedidos que llegan por canales sin conector (WhatsApp, mostrador, teléfono).

Formulario rápido:
- Canal (WhatsApp / Mostrador / Teléfono / Otro)
- Items (nombre, cantidad, precio)
- Total
- Notas
- Método de pago

---

## Historial de pedidos del día

Lista rápida consultable desde el panel:
- Filtro por canal
- Filtro por estado
- Búsqueda por cliente o número de pedido
- Ver detalle / imprimir comanda

---

## Futuras herramientas a considerar

- **Conversor de unidades** (gramos, kg, litros — útil para insumos)
- **Calculadora de recetas** (costo por porción a partir de ingredientes)
- **Recordatorios** (ej. "pedir insumos los lunes")
- **Notas del día** (observaciones internas del turno)
- **Control de stock básico** (decrementa con cada pedido si hay catálogo cargado)
