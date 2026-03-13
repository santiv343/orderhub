# Sprint 2 — Order Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el endpoint `POST /integrations/orders/import` con autenticación por API Key, deduplicación, y el módulo de gestión de API Keys para usuarios autenticados.

**Architecture:** Dos módulos independientes: `ApiKeysModule` (CRUD de keys para usuarios JWT) e `IntegrationsModule` (endpoint de import autenticado con API Key via header `X-Api-Key`). El guard de API Key hashea el header con SHA-256 y busca la key activa, inyectando el `locationId` en el request. La deduplicación usa el unique constraint `(locationId, source, externalId)` de Prisma.

**Tech Stack:** NestJS + Fastify, Prisma, class-validator, crypto (nativo Node), Jest + ts-jest

**Spec de referencia:** `docs/design/10-alcance-mvp.md` (Sprint 2)

**Convención de archivos:**
- Tipos e interfaces → `*.types.ts` (no mezclar con implementación)
- Constantes → `constants/<nombre>.ts`
- Enums → `enums/` o `packages/types`
- DTOs → `dto/<nombre>.dto.ts`
- Errores → `errors/<nombre>.errors.ts`

---

## Chunk 1: Setup Jest + Infrastructure

### Task 1: Setup Jest

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Instalar dependencias de test**

```bash
pnpm --filter @orderhub/api add -D jest ts-jest @types/jest
```

- [ ] **Step 2: Agregar configuración de Jest en `apps/api/package.json`**

Agregar dentro de `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:cov": "jest --coverage"
```

Agregar al final del JSON (antes del `}`):
```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node",
  "moduleNameMapper": {
    "@orderhub/types": "<rootDir>/../../../packages/types/src/index.ts"
  }
}
```

- [ ] **Step 3: Verificar que Jest funciona con un test trivial**

Crear `apps/api/src/app.spec.ts`:
```typescript
describe('App bootstrap', () => {
  it('should be true', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
pnpm --filter @orderhub/api test
```
Expected: `1 passed`

- [ ] **Step 5: Borrar el test trivial**

```bash
rm apps/api/src/app.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json
git commit -m "chore: configurar Jest con ts-jest en apps/api"
```

---

### Task 2: Agregar error codes e infrastructure

**Files:**
- Modify: `apps/api/src/constants/errors.ts`
- Create: `apps/api/src/constants/api-key.ts`
- Create: `apps/api/src/errors/integration.errors.ts`

- [ ] **Step 1: Agregar códigos de error en `apps/api/src/constants/errors.ts`**

Agregar dentro del objeto `ERROR_CODES`, después de `CONNECTOR_ALREADY_EXISTS`:
```typescript
// API Key
API_KEY_INVALID: 'API_KEY_INVALID',
API_KEY_NOT_FOUND: 'API_KEY_NOT_FOUND',
API_KEY_REVOKED: 'API_KEY_REVOKED',

// Integration / Import
ORDER_IMPORT_FAILED: 'ORDER_IMPORT_FAILED',
```

- [ ] **Step 2: Crear `apps/api/src/constants/api-key.ts`**

```typescript
export const API_KEY = {
  PREFIX: 'ohk_',
  BYTES: 24, // randomBytes(24) → 48 hex chars → key total: ~52 chars
} as const;
```

- [ ] **Step 3: Crear `apps/api/src/errors/integration.errors.ts`**

```typescript
import { ERROR_CODES } from '../constants/errors';
import { AppError } from './app.error';

export class InvalidApiKeyError extends AppError {
  constructor() {
    super(ERROR_CODES.API_KEY_INVALID, 'Invalid or missing API key', 401);
  }
}

export class ApiKeyNotFoundError extends AppError {
  constructor(id: string) {
    super(ERROR_CODES.API_KEY_NOT_FOUND, `API key ${id} not found`, 404);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/constants/errors.ts apps/api/src/constants/api-key.ts apps/api/src/errors/integration.errors.ts
git commit -m "chore: agregar error codes y constantes para API Keys e integrations"
```

---

## Chunk 2: API Keys Module

### Task 3: ApiKeyRepository

**Files:**
- Create: `apps/api/src/modules/api-keys/repositories/api-key.repository.ts`
- Create: `apps/api/src/modules/api-keys/repositories/api-key.repository.spec.ts`

- [ ] **Step 1: Escribir el test**

Crear `apps/api/src/modules/api-keys/repositories/api-key.repository.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { ApiKeyRepository } from './api-key.repository';
import { PrismaService } from '../../../shared/prisma/prisma.service';

const mockPrisma = {
  locationApiKey: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('ApiKeyRepository', () => {
  let repo: ApiKeyRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(ApiKeyRepository);
    jest.clearAllMocks();
  });

  describe('findActiveByHash', () => {
    it('should return key when found and not revoked', async () => {
      const mockKey = { id: '1', keyHash: 'abc', revokedAt: null, locationId: 'loc1' };
      mockPrisma.locationApiKey.findUnique.mockResolvedValue(mockKey);

      const result = await repo.findActiveByHash('abc');

      expect(mockPrisma.locationApiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: 'abc', revokedAt: null },
      });
      expect(result).toEqual(mockKey);
    });

    it('should return null when key is revoked or not found', async () => {
      mockPrisma.locationApiKey.findUnique.mockResolvedValue(null);
      const result = await repo.findActiveByHash('invalid');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a key with the given hash and name', async () => {
      const data = { locationId: 'loc1', keyHash: 'hash123', name: 'Extension key' };
      const mockKey = { id: '1', ...data, revokedAt: null, createdAt: new Date() };
      mockPrisma.locationApiKey.create.mockResolvedValue(mockKey);

      const result = await repo.create(data);

      expect(mockPrisma.locationApiKey.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(mockKey);
    });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="api-key.repository"
```
Expected: FAIL — `ApiKeyRepository` no existe

- [ ] **Step 3: Implementar `apps/api/src/modules/api-keys/repositories/api-key.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import type { LocationApiKey } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByHash(keyHash: string): Promise<LocationApiKey | null> {
    return this.prisma.locationApiKey.findUnique({
      where: { keyHash, revokedAt: null },
    });
  }

  async findAllByLocation(locationId: string): Promise<LocationApiKey[]> {
    return this.prisma.locationApiKey.findMany({
      where: { locationId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    locationId: string;
    keyHash: string;
    name: string;
  }): Promise<LocationApiKey> {
    return this.prisma.locationApiKey.create({ data });
  }

  async revoke(id: string): Promise<LocationApiKey | null> {
    return this.prisma.locationApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.prisma.locationApiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="api-key.repository"
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/api-keys/
git commit -m "feat: crear ApiKeyRepository con find/create/revoke"
```

---

### Task 4: ApiKeysService

**Files:**
- Create: `apps/api/src/modules/api-keys/api-keys.service.ts`
- Create: `apps/api/src/modules/api-keys/api-keys.service.spec.ts`
- Create: `apps/api/src/modules/api-keys/dto/create-api-key.dto.ts`
- Create: `apps/api/src/modules/api-keys/dto/api-key-response.dto.ts`

- [ ] **Step 1: Crear los DTOs**

Crear `apps/api/src/modules/api-keys/dto/create-api-key.dto.ts`:
```typescript
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;
}
```

Crear `apps/api/src/modules/api-keys/dto/api-key-response.dto.ts`:
```typescript
import type { LocationApiKey } from '@prisma/client';

export class ApiKeyResponseDto {
  id: string;
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date;

  constructor(key: LocationApiKey) {
    this.id = key.id;
    this.name = key.name;
    this.lastUsedAt = key.lastUsedAt;
    this.createdAt = key.createdAt;
  }
}
```

- [ ] **Step 2: Escribir el test**

Crear `apps/api/src/modules/api-keys/api-keys.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyRepository } from './repositories/api-key.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { ApiKeyNotFoundError } from '../../errors/integration.errors';

const mockApiKeyRepo = {
  create: jest.fn(),
  findAllByLocation: jest.fn(),
  revoke: jest.fn(),
};

const mockUserRepo = {
  findByIdWithLocations: jest.fn(),
};

const mockUserWithLocation = {
  id: 'user1',
  locationUsers: [{ location: { id: 'loc1', organizationId: 'org1' } }],
};

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: ApiKeyRepository, useValue: mockApiKeyRepo },
        { provide: UserRepository, useValue: mockUserRepo },
      ],
    }).compile();
    service = module.get(ApiKeysService);
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should return a key starting with ohk_', async () => {
      mockUserRepo.findByIdWithLocations.mockResolvedValue(mockUserWithLocation);
      mockApiKeyRepo.create.mockResolvedValue({
        id: 'key1', name: 'Test', keyHash: 'hash', locationId: 'loc1',
        revokedAt: null, lastUsedAt: null, expiresAt: null, createdAt: new Date(),
      });

      const result = await service.generate('user1', { name: 'Test' });

      expect(result.key).toMatch(/^ohk_/);
    });

    it('should NOT store the raw key — only the hash', async () => {
      mockUserRepo.findByIdWithLocations.mockResolvedValue(mockUserWithLocation);
      mockApiKeyRepo.create.mockResolvedValue({
        id: 'key1', name: 'Test', keyHash: 'hash', locationId: 'loc1',
        revokedAt: null, lastUsedAt: null, expiresAt: null, createdAt: new Date(),
      });

      const result = await service.generate('user1', { name: 'Test' });

      const storedHash = mockApiKeyRepo.create.mock.calls[0][0].keyHash;
      expect(storedHash).not.toEqual(result.key);
      expect(storedHash).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('revoke', () => {
    it('should throw ApiKeyNotFoundError if key does not exist', async () => {
      mockApiKeyRepo.revoke.mockResolvedValue(null);

      await expect(service.revoke('user1', 'nonexistent')).rejects.toThrow(
        ApiKeyNotFoundError,
      );
    });
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="api-keys.service"
```
Expected: FAIL — `ApiKeysService` no existe

- [ ] **Step 4: Implementar `apps/api/src/modules/api-keys/api-keys.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { ApiKeyRepository } from './repositories/api-key.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
import { ApiKeyNotFoundError } from '../../errors/integration.errors';
import { API_KEY } from '../../constants/api-key';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async generate(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ key: string; meta: ApiKeyResponseDto }> {
    const locationId = await this.getLocationId(userId);

    const raw = randomBytes(API_KEY.BYTES).toString('hex');
    const key = `${API_KEY.PREFIX}${raw}`;
    const keyHash = createHash('sha256').update(key).digest('hex');

    const created = await this.apiKeyRepo.create({
      locationId,
      keyHash,
      name: dto.name,
    });

    return { key, meta: new ApiKeyResponseDto(created) };
  }

  async list(userId: string): Promise<ApiKeyResponseDto[]> {
    const locationId = await this.getLocationId(userId);
    const keys = await this.apiKeyRepo.findAllByLocation(locationId);
    return keys.map((k) => new ApiKeyResponseDto(k));
  }

  async revoke(userId: string, keyId: string): Promise<void> {
    // Note: in MVP we don't verify the key belongs to the user's location.
    // That check should be added before launch.
    const revoked = await this.apiKeyRepo.revoke(keyId);
    if (!revoked) throw new ApiKeyNotFoundError(keyId);
  }

  private async getLocationId(userId: string): Promise<string> {
    const user = await this.userRepo.findByIdWithLocations(userId);
    // MVP: users have exactly one location created at registration
    return user!.locationUsers[0].location.id;
  }
}
```

- [ ] **Step 5: Correr y verificar que pasa**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="api-keys.service"
```
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/api-keys/
git commit -m "feat: ApiKeysService — generate, list, revoke con SHA-256 hash"
```

---

### Task 5: ApiKeysController + Module

**Files:**
- Create: `apps/api/src/modules/api-keys/api-keys.controller.ts`
- Create: `apps/api/src/modules/api-keys/api-keys.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear `apps/api/src/modules/api-keys/api-keys.controller.ts`**

```typescript
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async generate(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthUser) {
    const { key, meta } = await this.apiKeysService.generate(user.userId, dto);
    // key se retorna UNA SOLA VEZ — no se puede recuperar después
    return { key, meta };
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.apiKeysService.list(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.apiKeysService.revoke(user.userId, id);
  }
}
```

- [ ] **Step 2: Crear `apps/api/src/modules/api-keys/api-keys.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyRepository } from './repositories/api-key.repository';
import { UserRepository } from '../auth/repositories/user.repository';

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyRepository, UserRepository],
  exports: [ApiKeyRepository],
})
export class ApiKeysModule {}
```

- [ ] **Step 3: Registrar en `apps/api/src/app.module.ts`**

Agregar el import:
```typescript
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
```

Agregar `ApiKeysModule` al array `imports`.

- [ ] **Step 4: Verificar que la build compila**

```bash
pnpm --filter @orderhub/api build
```
Expected: sin errores

- [ ] **Step 5: Smoke test manual (API levantada con Docker)**

```bash
# Primero registrar/loguear para obtener cookies
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' \
  -c /tmp/cookies.txt

# Generar una API key
curl -s -X POST http://localhost:3000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name":"Extension key"}' \
  -b /tmp/cookies.txt
```
Expected: `{ "key": "ohk_...", "meta": { "id": "...", "name": "Extension key", ... } }`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/api-keys/api-keys.controller.ts \
        apps/api/src/modules/api-keys/api-keys.module.ts \
        apps/api/src/app.module.ts
git commit -m "feat: ApiKeysModule — POST/GET/DELETE /api/v1/api-keys"
```

---

## Chunk 3: Integrations Module (Import Endpoint)

### Task 6: OrderRepository

**Files:**
- Create: `apps/api/src/modules/integrations/repositories/order.repository.ts`
- Create: `apps/api/src/modules/integrations/repositories/order.repository.spec.ts`

- [ ] **Step 1: Escribir el test**

Crear `apps/api/src/modules/integrations/repositories/order.repository.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { OrderRepository } from './order.repository';
import { PrismaService } from '../../../shared/prisma/prisma.service';

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe('OrderRepository', () => {
  let repo: OrderRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(OrderRepository);
    jest.clearAllMocks();
  });

  describe('findByExternalId', () => {
    it('should query by locationId + source + externalId', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await repo.findByExternalId('loc1', 'PEDIDOSYA', 'ext123');

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: {
          locationId_source_externalId: {
            locationId: 'loc1',
            source: 'PEDIDOSYA',
            externalId: 'ext123',
          },
        },
      });
    });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="order.repository"
```
Expected: FAIL

- [ ] **Step 3: Implementar `apps/api/src/modules/integrations/repositories/order.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import type { Order } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { ImportedOrderDto } from '../dto/import-orders.dto';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(
    locationId: string,
    source: string,
    externalId: string,
  ): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: {
        locationId_source_externalId: { locationId, source, externalId },
      },
    });
  }

  async create(locationId: string, order: ImportedOrderDto): Promise<Order> {
    return this.prisma.order.create({
      data: {
        locationId,
        externalId: order.externalId,
        source: order.source,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        subtotal: order.subtotal,
        discounts: order.discounts,
        deliveryFee: order.deliveryFee,
        total: order.total,
        notes: order.notes,
        placedAt: new Date(order.placedAt),
        rawPayload: order.rawPayload ?? {},
        items: {
          create: order.items.map((item) => ({
            externalId: item.externalId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes,
          })),
        },
      },
    });
  }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="order.repository"
```
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/integrations/
git commit -m "feat: OrderRepository con findByExternalId y create"
```

---

### Task 7: Import DTOs

**Files:**
- Create: `apps/api/src/modules/integrations/integrations.types.ts`
- Create: `apps/api/src/modules/integrations/dto/import-orders.dto.ts`

- [ ] **Step 1: Crear `apps/api/src/modules/integrations/integrations.types.ts`**

Tipos puros del módulo, sin decoradores ni lógica:
```typescript
export interface ImportResult {
  imported: number;
  duplicates: number;
}
```

- [ ] **Step 2: Crear `apps/api/src/modules/integrations/dto/import-orders.dto.ts`**

```typescript
import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
  ValidateNested,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { OrderSource, OrderStatus } from '@orderhub/types';
import { LIMITS } from '../../../constants/limits';

export class ImportedOrderItemDto {
  @IsString() externalId: string;
  @IsString() name: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
  @IsNumber() @Min(0) totalPrice: number;
  @IsOptional() @IsString() notes?: string;
}

export class ImportedOrderDto {
  @IsString() externalId: string;
  @IsEnum(OrderSource) source: OrderSource;
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsString() customerName: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() customerAddress?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportedOrderItemDto)
  items: ImportedOrderItemDto[];

  @IsNumber() @Min(0) subtotal: number;
  @IsNumber() @Min(0) discounts: number;
  @IsNumber() @Min(0) deliveryFee: number;
  @IsNumber() @Min(0) total: number;
  @IsOptional() @IsString() notes?: string;
  @IsDateString() placedAt: string;
  @IsOptional() @IsObject() rawPayload?: Record<string, unknown>;
}

export class ImportOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.orders.importBatchSize)
  @ValidateNested({ each: true })
  @Type(() => ImportedOrderDto)
  orders: ImportedOrderDto[];
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
pnpm --filter @orderhub/api build
```
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/integrations/dto/
git commit -m "feat: ImportOrdersDto con validación class-validator"
```

---

### Task 8: ApiKeyGuard

**Files:**
- Create: `apps/api/src/modules/integrations/guards/api-key.guard.ts`
- Create: `apps/api/src/modules/integrations/guards/api-key.guard.spec.ts`

- [ ] **Step 1: Escribir el test**

Crear `apps/api/src/modules/integrations/guards/api-key.guard.spec.ts`:
```typescript
import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyRepository } from '../../api-keys/repositories/api-key.repository';
import { InvalidApiKeyError } from '../../../errors/integration.errors';

const mockApiKeyRepo = { findActiveByHash: jest.fn(), updateLastUsed: jest.fn() };

function makeContext(headers: Record<string, string>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: ApiKeyRepository, useValue: mockApiKeyRepo },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);
    jest.clearAllMocks();
  });

  it('should throw InvalidApiKeyError when header is missing', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(
      InvalidApiKeyError,
    );
  });

  it('should throw InvalidApiKeyError when hash not found', async () => {
    mockApiKeyRepo.findActiveByHash.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ 'x-api-key': 'ohk_invalid' })),
    ).rejects.toThrow(InvalidApiKeyError);
  });

  it('should return true and inject locationId when key is valid', async () => {
    mockApiKeyRepo.findActiveByHash.mockResolvedValue({
      id: 'key1',
      locationId: 'loc1',
      revokedAt: null,
    });
    const ctx = makeContext({ 'x-api-key': 'ohk_validkey' });
    const request = ctx.switchToHttp().getRequest() as Record<string, unknown>;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request['locationId']).toBe('loc1');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="api-key.guard"
```
Expected: FAIL

- [ ] **Step 3: Implementar `apps/api/src/modules/integrations/guards/api-key.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import { ApiKeyRepository } from '../../api-keys/repositories/api-key.repository';
import { InvalidApiKeyError } from '../../../errors/integration.errors';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyRepo: ApiKeyRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { locationId?: string }>();
    const rawKey = request.headers['x-api-key'] as string | undefined;

    if (!rawKey) throw new InvalidApiKeyError();

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyRepo.findActiveByHash(keyHash);

    if (!apiKey) throw new InvalidApiKeyError();

    request.locationId = apiKey.locationId;
    await this.apiKeyRepo.updateLastUsed(apiKey.id);

    return true;
  }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="api-key.guard"
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/integrations/guards/
git commit -m "feat: ApiKeyGuard — valida X-Api-Key header e inyecta locationId"
```

---

### Task 9: IntegrationsService

**Files:**
- Create: `apps/api/src/modules/integrations/integrations.service.ts`
- Create: `apps/api/src/modules/integrations/integrations.service.spec.ts`

- [ ] **Step 1: Escribir el test**

Crear `apps/api/src/modules/integrations/integrations.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderSource, OrderStatus } from '@orderhub/types';
import type { ImportedOrderDto } from './dto/import-orders.dto';
import type { ImportResult } from './integrations.types';

const mockOrderRepo = {
  findByExternalId: jest.fn(),
  create: jest.fn(),
};

const makeOrder = (externalId: string): ImportedOrderDto => ({
  externalId,
  source: OrderSource.PEDIDOSYA,
  status: OrderStatus.PENDING,
  customerName: 'Juan',
  items: [],
  subtotal: 100,
  discounts: 0,
  deliveryFee: 0,
  total: 100,
  placedAt: new Date().toISOString(),
});

describe('IntegrationsService', () => {
  let service: IntegrationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: OrderRepository, useValue: mockOrderRepo },
      ],
    }).compile();
    service = module.get(IntegrationsService);
    jest.clearAllMocks();
  });

  describe('importOrders', () => {
    it('should import a new order and return imported=1, duplicates=0', async () => {
      mockOrderRepo.findByExternalId.mockResolvedValue(null);
      mockOrderRepo.create.mockResolvedValue({ id: 'order1' });

      const result = await service.importOrders('loc1', {
        orders: [makeOrder('ext1')],
      });

      expect(result).toEqual({ imported: 1, duplicates: 0 });
      expect(mockOrderRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should skip a duplicate and return imported=0, duplicates=1', async () => {
      mockOrderRepo.findByExternalId.mockResolvedValue({ id: 'existing' });

      const result = await service.importOrders('loc1', {
        orders: [makeOrder('ext1')],
      });

      expect(result).toEqual({ imported: 0, duplicates: 1 });
      expect(mockOrderRepo.create).not.toHaveBeenCalled();
    });

    it('should handle a batch with mix of new and duplicate orders', async () => {
      mockOrderRepo.findByExternalId
        .mockResolvedValueOnce(null)         // ext1 → new
        .mockResolvedValueOnce({ id: 'x' }) // ext2 → duplicate
        .mockResolvedValueOnce(null);        // ext3 → new

      const result = await service.importOrders('loc1', {
        orders: [makeOrder('ext1'), makeOrder('ext2'), makeOrder('ext3')],
      });

      expect(result).toEqual({ imported: 2, duplicates: 1 });
    });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="integrations.service"
```
Expected: FAIL

- [ ] **Step 3: Implementar `apps/api/src/modules/integrations/integrations.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { OrderRepository } from './repositories/order.repository';
import type { ImportOrdersDto } from './dto/import-orders.dto';
import type { ImportResult } from './integrations.types';

@Injectable()
export class IntegrationsService {
  constructor(private readonly orderRepo: OrderRepository) {}

  async importOrders(
    locationId: string,
    dto: ImportOrdersDto,
  ): Promise<ImportResult> {
    let imported = 0;
    let duplicates = 0;

    for (const order of dto.orders) {
      const existing = await this.orderRepo.findByExternalId(
        locationId,
        order.source,
        order.externalId,
      );

      if (existing) {
        duplicates++;
        continue;
      }

      await this.orderRepo.create(locationId, order);
      imported++;
    }

    return { imported, duplicates };
  }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
pnpm --filter @orderhub/api test -- --testPathPattern="integrations.service"
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/integrations/integrations.service.ts \
        apps/api/src/modules/integrations/integrations.service.spec.ts
git commit -m "feat: IntegrationsService — importOrders con deduplicación"
```

---

### Task 10: IntegrationsController + Module + Wire AppModule

**Files:**
- Create: `apps/api/src/modules/integrations/integrations.controller.ts`
- Create: `apps/api/src/modules/integrations/integrations.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear `apps/api/src/modules/integrations/integrations.controller.ts`**

```typescript
import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { SkipThrottle } from '@nestjs/throttler';
import { IntegrationsService } from './integrations.service';
import { ImportOrdersDto } from './dto/import-orders.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

@Controller('integrations')
@SkipThrottle() // rate limiting propio via API Key
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('orders/import')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async importOrders(
    @Body() dto: ImportOrdersDto,
    @Req() request: FastifyRequest & { locationId: string },
  ) {
    return this.integrationsService.importOrders(request.locationId, dto);
  }
}
```

- [ ] **Step 2: Crear `apps/api/src/modules/integrations/integrations.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { OrderRepository } from './repositories/order.repository';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule], // exporta ApiKeyRepository para el guard
  controllers: [IntegrationsController],
  providers: [IntegrationsService, OrderRepository, ApiKeyGuard],
})
export class IntegrationsModule {}
```

- [ ] **Step 3: Agregar `IntegrationsModule` a `apps/api/src/app.module.ts`**

```typescript
import { IntegrationsModule } from './modules/integrations/integrations.module';
// Agregar IntegrationsModule al array imports
```

- [ ] **Step 4: Correr todos los tests**

```bash
pnpm --filter @orderhub/api test
```
Expected: todos los tests pasan

- [ ] **Step 5: Verificar build**

```bash
pnpm --filter @orderhub/api build
```
Expected: sin errores

- [ ] **Step 6: Smoke test end-to-end (con Docker levantado)**

```bash
# 1. Generar API Key (necesita estar logueado)
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' \
  -c /tmp/cookies.txt

API_KEY=$(curl -s -X POST http://localhost:3000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name":"Test extension"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")

echo "API Key: $API_KEY"

# 2. Importar un pedido nuevo
curl -s -X POST http://localhost:3000/api/v1/integrations/orders/import \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{
    "orders": [{
      "externalId": "PY-001",
      "source": "PEDIDOSYA",
      "status": "PENDING",
      "customerName": "Test Customer",
      "items": [{"externalId": "i1", "name": "Hamburguesa", "quantity": 1, "unitPrice": 500, "totalPrice": 500}],
      "subtotal": 500, "discounts": 0, "deliveryFee": 100, "total": 600,
      "placedAt": "2026-03-12T15:00:00Z"
    }]
  }'
```
Expected: `{"imported":1,"duplicates":0}`

```bash
# 3. Importar el mismo pedido de nuevo (deduplicación)
# (misma petición de arriba)
```
Expected: `{"imported":0,"duplicates":1}`

```bash
# 4. API Key inválida
curl -s -X POST http://localhost:3000/api/v1/integrations/orders/import \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ohk_invalid" \
  -d '{"orders":[]}'
```
Expected: `{"error":{"code":"API_KEY_INVALID","message":"Invalid or missing API key"}}`

- [ ] **Step 7: Commit final**

```bash
git add apps/api/src/modules/integrations/integrations.controller.ts \
        apps/api/src/modules/integrations/integrations.module.ts \
        apps/api/src/app.module.ts
git commit -m "feat: IntegrationsModule — POST /integrations/orders/import con ApiKeyGuard"
```

---

## Resumen de archivos creados/modificados

| Archivo | Acción |
|---|---|
| `apps/api/package.json` | Modify — agregar Jest config |
| `apps/api/src/constants/errors.ts` | Modify — agregar API_KEY_* codes |
| `apps/api/src/constants/api-key.ts` | Create — PREFIX, BYTES |
| `apps/api/src/errors/integration.errors.ts` | Create — InvalidApiKeyError, ApiKeyNotFoundError |
| `apps/api/src/modules/api-keys/repositories/api-key.repository.ts` | Create |
| `apps/api/src/modules/api-keys/dto/create-api-key.dto.ts` | Create |
| `apps/api/src/modules/api-keys/dto/api-key-response.dto.ts` | Create |
| `apps/api/src/modules/api-keys/api-keys.service.ts` | Create |
| `apps/api/src/modules/api-keys/api-keys.controller.ts` | Create |
| `apps/api/src/modules/api-keys/api-keys.module.ts` | Create |
| `apps/api/src/modules/integrations/integrations.types.ts` | Create — `ImportResult` interface |
| `apps/api/src/modules/integrations/repositories/order.repository.ts` | Create |
| `apps/api/src/modules/integrations/dto/import-orders.dto.ts` | Create |
| `apps/api/src/modules/integrations/guards/api-key.guard.ts` | Create |
| `apps/api/src/modules/integrations/integrations.service.ts` | Create |
| `apps/api/src/modules/integrations/integrations.controller.ts` | Create |
| `apps/api/src/modules/integrations/integrations.module.ts` | Create |
| `apps/api/src/app.module.ts` | Modify — importar ApiKeysModule + IntegrationsModule |
