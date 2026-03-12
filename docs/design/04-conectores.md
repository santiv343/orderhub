# Conectores

## Concepto

Un conector es un adaptador entre una plataforma externa y el core de Orderhub.

Cada conector:
- Obtiene datos de su plataforma (DOM, API interna, archivo, input manual)
- Encapsula las reglas de negocio de esa plataforma
- Normaliza los datos al formato `ImportedOrder`
- Los envía al backend via `POST /integrations/orders/import`

El backend no conoce nada de ninguna plataforma. Siempre trabaja con `ImportedOrder`.

---

## Contrato estándar: ImportedOrder

```typescript
type ImportedOrder = {
  source: 'pedidosya' | 'ubereats' | 'rappi' | 'manual' | 'whatsapp' | 'csv';
  externalOrderId: string;
  createdAt?: string;           // ISO 8601
  customerName?: string;
  paymentMethod?: string;
  notes?: string;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  total: number;                // único campo requerido además de source y externalOrderId
  items: {
    name: string;
    quantity: number;
    price?: number;
  }[];
  cancellation?: {
    reason: 'platform' | 'customer' | 'seller';
    hadCost?: boolean;
  };
}
```

---

## Conector PedidosYa (MVP — Chrome Extension)

### Por qué extensión

PedidosYa no ofrece API pública para desarrolladores individuales.
La integración se realiza desde el panel web de PedidosYa Merchant.

### Estrategia de captura

**Estrategia principal: interceptar requests internos vía page context**

PedidosYa Merchant es una SPA (React). Consume sus propias APIs internas.
La extensión intercepta los requests leyendo el JSON directamente.

**Importante — Manifest v3:** La API `webRequest` en Manifest v3 NO permite leer el cuerpo de las respuestas. No usar `chrome.webRequest` para esto.

El enfoque correcto es inyectar un script en el **contexto de la página** (no el contexto del content script) que envuelva el `fetch` nativo antes de que la SPA lo use:

```typescript
// content.ts — inyecta el script en el contexto de la página
const script = document.createElement('script')
script.src = chrome.runtime.getURL('injected.js')
document.documentElement.prepend(script)

// injected.ts — corre en el contexto de la PÁGINA, tiene acceso al fetch real
const originalFetch = window.fetch
window.fetch = async (...args) => {
  const res = await originalFetch(...args)
  const clone = res.clone()
  clone.json()
    .then(data => {
      window.dispatchEvent(new CustomEvent('orderhub:request', {
        detail: { url: args[0], data }
      }))
    })
    .catch(() => {})
  return res
}

// content.ts — escucha los eventos del contexto de la página
window.addEventListener('orderhub:request', (e: CustomEvent) => {
  processIfOrder(e.detail.url, e.detail.data)
})
```

El script inyectado debe declararse en `manifest.json` como `web_accessible_resources`.

**Estrategia de fallback: parseo de DOM**

Si la intercepción no es suficiente, se parsea el DOM como respaldo.
Se usa `MutationObserver` para detectar cambios en la SPA.

### Flujo MVP (manual)

1. Usuario abre el panel de PedidosYa Merchant
2. La extensión detecta la página
3. La extensión inserta un botón "Importar pedido"
4. El usuario hace click
5. Se extrae el pedido (intercepción o DOM)
6. Se convierte a `ImportedOrder`
7. Se envía al backend
8. Confirmación visual

### Flujo objetivo (automático)

1. `MutationObserver` detecta nuevo pedido en el panel
2. Se extrae automáticamente
3. Se envía al backend sin intervención del usuario
4. Notificación en el ícono de la extensión

### Estructura de la extensión

```
extensions/pedidosya/
├── manifest.json
└── src/
    ├── content.ts       ← se ejecuta en el panel de PedidosYa
    ├── background.ts    ← service worker, maneja la cola de reintentos
    ├── interceptor.ts   ← intercepta requests fetch/XHR
    ├── parser.ts        ← parsea DOM como fallback
    └── api.ts           ← envía al backend, maneja cola offline
```

### Manifest v3

```json
{
  "manifest_version": 3,
  "name": "Orderhub — PedidosYa Importer",
  "version": "0.1.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://*.pedidosya.com/*",
    "https://api.orderhub.app/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://*.pedidosya.com/*"],
      "js": ["content.js"]
    }
  ]
}
```

### Reglas de negocio de PedidosYa

| Situación | Comportamiento |
|---|---|
| Cancela la plataforma | Sin pérdida para el vendedor |
| Cancela el cliente | Sin pérdida para el vendedor |
| Cancela el vendedor | Posible pérdida — el sistema pregunta |
| Comisión | Configurada por el usuario en LocationConnector |

---

## Cola de reintentos (offline resilience)

La extensión nunca pierde un pedido aunque el backend esté caído.

```
Pedido detectado
    ↓
chrome.storage.local → queue[]
    ↓
background service worker
    ↓
intenta POST al backend
    ├── éxito → elimina de la cola
    └── fallo → reintenta con backoff exponencial
                (1s → 2s → 4s → 8s → ... → máximo N intentos)
```

El ícono de la extensión muestra un badge con pedidos pendientes de sincronizar.

---

## Distribución

**MVP:** Sideloaded (Developer Mode en Chrome)
**Futuro:** Chrome Web Store

### Testing local

1. Abrir `chrome://extensions`
2. Activar Developer mode
3. Load unpacked → seleccionar carpeta `extensions/pedidosya/dist`
4. Abrir PedidosYa Merchant
5. Revisar consola para ver requests interceptados

---

## Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| Cambios en el DOM | Parser flexible, interceptación como estrategia principal |
| Cambios en las APIs internas | Múltiples estrategias de extracción |
| Pedidos duplicados | `unique(locationId, source, externalOrderId)` |
| Backend caído | Cola local con reintentos |
| Datos incompletos | Todos los campos son opcionales excepto `total` |

---

## Conectores futuros planificados

| Conector | Estrategia |
|---|---|
| Uber Eats | Chrome Extension (mismo patrón) |
| Rappi | Chrome Extension (mismo patrón) |
| CSV Import | Upload de archivo, parser en backend |
| Manual | Formulario en el dashboard |
| WhatsApp | Formulario guiado o futuro bot |
| API oficial | Si PedidosYa u otros abren API pública |
