# Seguridad y autenticación

## Autenticación de usuarios

Stack: JWT + refresh tokens con rotation.

**JWT almacenado en httpOnly cookie** — nunca localStorage.
- Protegido de XSS (JavaScript no puede acceder a la cookie)
- Access token: 15 minutos de vida
- Refresh token: 7 días de vida, **rotation obligatoria** — cada uso invalida el token anterior y emite uno nuevo

```
POST /auth/register   ← crea usuario + organization + location
POST /auth/login      ← devuelve accessToken + refreshToken
POST /auth/refresh    ← renueva accessToken
POST /auth/logout
```

El `accessToken` incluye en el payload:
```json
{
  "userId": "...",
  "selectedLocationId": "...",
  "role": "manager"
}
```

---

## Autenticación de conectores (extensión)

Cada extensión se autentica con una **API Key** por location.

### Flujo
1. El usuario genera una API Key desde el dashboard (`Settings → Conectores → Nueva API Key`)
2. La key se muestra una única vez
3. El usuario la carga en la extensión (se guarda en `chrome.storage.sync`)
4. Todos los requests de la extensión llevan: `Authorization: Bearer <apiKey>`

### Modelo
```
LocationApiKey
  id
  locationId
  keyHash          ← nunca se guarda en texto plano
  label            ← "Extensión PedidosYa - Local Centro"
  lastUsedAt
  createdAt
  revokedAt (nullable)
```

La key original solo se muestra en el momento de creación. Se guarda el hash.

---

## Autorización por roles

Todas las rutas del backend verifican el rol del usuario para el location activo.

| Recurso | owner | admin | manager | operator | viewer |
|---|---|---|---|---|---|
| Ver ventas y pedidos | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver costos y márgenes | ✓ | ✓ | ✓ | ✗ | ✗ |
| Ver reportes completos | ✓ | ✓ | ✓ | ✗ | ✗ |
| Importar pedidos | ✓ | ✓ | ✓ | ✓ | ✗ |
| Gestionar productos | ✓ | ✓ | ✓ | ✗ | ✗ |
| Gestionar gastos | ✓ | ✓ | ✓ | ✗ | ✗ |
| Bloquear cierre diario | ✓ | ✓ | ✓ | ✗ | ✗ |
| Gestionar empleados | ✓ | ✓ | ✗ | ✗ | ✗ |
| Gestionar conectores | ✓ | ✓ | ✗ | ✗ | ✗ |
| Ver todos los locales | ✓ | ✓ | ✗ | ✗ | ✗ |
| Gestionar billing | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## Aislamiento de datos

**Regla crítica:** todo query en el backend filtra siempre por `locationId`.

El `locationId` se resuelve desde el token (usuarios web) o desde la API Key (conectores).
Nunca se acepta `locationId` como parámetro del cliente.

---

## Rate limiting

- Endpoint de importación: máximo 60 requests/minuto por API Key
- Endpoints de auth: máximo 10 intentos/minuto por IP
- Endpoints generales: máximo 300 requests/minuto por usuario

---

## Seguridad adicional

- Passwords hasheados con bcrypt (salt rounds: 12)
- HTTPS obligatorio en producción
- CORS configurado solo para los dominios permitidos
- Validación estricta de todos los inputs (class-validator en NestJS)
- Soft deletes para todos los registros financieros
- AuditLog para cambios en entidades críticas
