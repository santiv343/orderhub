# Refactor Pre-Sprint 2 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the codebase in 3 sequential layers to fix inconsistencies, improve architecture, add real security, and integrate shadcn/ui + Zustand before Sprint 2 feature work begins.

**Architecture:** Sequential layers — each must compile before advancing. Capa 1 fixes low-risk inconsistencies. Capa 2 restructures the API with repository pattern and security. Capa 3 modernizes the frontend with component library and state management.

**Tech Stack:** NestJS/Fastify, Prisma, @nestjs/throttler, @fastify/helmet, Next.js 14, shadcn/ui, Zustand, React Query, Zod

**Spec:** `docs/superpowers/specs/2026-03-12-code-improvements-design.md`

---

## Chunk 1: Capa 1 — DX & Consistencia

### Files

- Modify: `apps/web/src/app/auth/` → DELETE entire directory
- Modify: `apps/web/src/app/dashboard/` → DELETE entire directory
- Modify: `apps/web/src/i18n/locales/en.json`
- Modify: `apps/api/src/modules/auth/dto/login.dto.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `.env.example`

---

### Task 1.1: Eliminar rutas duplicadas

- [ ] Eliminar directorio `apps/web/src/app/auth/` completo

```bash
rm -rf apps/web/src/app/auth
```

- [ ] Eliminar directorio `apps/web/src/app/dashboard/` completo

```bash
rm -rf apps/web/src/app/dashboard
```

- [ ] Verificar que quedan solo los route groups con paréntesis

```bash
ls apps/web/src/app/
# Esperado: (auth)/  (dashboard)/  globals.css  layout.tsx  page.tsx
```

---

### Task 1.2: Completar en.json con claves de auth faltantes

- [ ] Reemplazar `apps/web/src/i18n/locales/en.json` con la versión completa:

```json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "confirm": "Confirm",
    "back": "Back",
    "search": "Search"
  },
  "nav": {
    "orders": "Orders",
    "products": "Products",
    "expenses": "Expenses",
    "dailyClose": "Daily Close",
    "reports": "Reports",
    "connectors": "Connectors",
    "settings": "Settings"
  },
  "orders": {
    "title": "Orders",
    "status": {
      "PENDING": "Pending",
      "CONFIRMED": "Confirmed",
      "IN_PREPARATION": "In Preparation",
      "READY": "Ready",
      "DELIVERED": "Delivered",
      "CANCELLED": "Cancelled",
      "REJECTED": "Rejected"
    }
  },
  "auth": {
    "login": "Log in",
    "loginTitle": "Welcome back",
    "loginSubtitle": "Sign in to your account",
    "register": "Register",
    "registerTitle": "Create account",
    "registerSubtitle": "Get started for free",
    "logout": "Log out",
    "email": "Email",
    "emailPlaceholder": "you@email.com",
    "password": "Password",
    "passwordPlaceholder": "At least 8 characters",
    "firstName": "First name",
    "lastName": "Last name",
    "businessName": "Business name",
    "businessNamePlaceholder": "e.g. The Pizzeria",
    "forgotPassword": "Forgot your password?",
    "resetPassword": "Reset password",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "errors": {
      "AUTH_INVALID_CREDENTIALS": "Incorrect email or password",
      "USER_ALREADY_EXISTS": "An account with that email already exists",
      "default": "Something went wrong, please try again"
    }
  }
}
```

---

### Task 1.3: Fix LoginDto — alinear MinLength con RegisterDto

- [ ] Editar `apps/api/src/modules/auth/dto/login.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

---

### Task 1.4: Fix tipos `any` en AuthService

- [ ] En `apps/api/src/modules/auth/auth.service.ts`, agregar import de Prisma y corregir los dos `any`:

Agregar al inicio del archivo (después de los imports existentes):
```typescript
import type { Prisma } from '@prisma/client';
```

Cambiar en el método `register` (línea ~49):
```typescript
// Antes:
const { user, location } = await this.prisma.$transaction(async (tx) => {

// Después:
const { user, location } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
```

Cambiar firma del método privado `uniqueSlug` (línea ~190):
```typescript
// Antes:
private async uniqueSlug(base: string, tx: any): Promise<string> {

// Después:
private async uniqueSlug(base: string, tx: Prisma.TransactionClient): Promise<string> {
```

---

### Task 1.5: Agregar NEXT_PUBLIC_API_URL a .env.example

- [ ] Agregar al bloque `# ─── App ───` en `.env.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

---

### Task 1.6: Verificar compilación y commit

- [ ] Verificar que la API compila:

```bash
cd apps/api && pnpm build
```
Esperado: build exitoso sin errores de TypeScript

- [ ] Verificar que el web compila:

```bash
cd apps/web && pnpm build
```
Esperado: build exitoso

- [ ] Commit:

```bash
git add apps/web/src/i18n/locales/en.json \
        apps/api/src/modules/auth/dto/login.dto.ts \
        apps/api/src/modules/auth/auth.service.ts \
        .env.example
git commit -m "fix: consistencia y deuda técnica menor (Capa 1)"
```

---

## Chunk 2: Capa 2 — Arquitectura y Seguridad API

### Files

- Create: `apps/api/src/modules/auth/repositories/user.repository.ts`
- Create: `apps/api/src/modules/auth/dto/auth-response.dto.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/package.json` (nuevas dependencias)

---

### Task 2.1: Instalar dependencias de seguridad

- [ ] Instalar `@nestjs/throttler` y `@fastify/helmet`:

```bash
cd apps/api && pnpm add @nestjs/throttler @fastify/helmet
```

---

### Task 2.2: Crear UserRepository

- [ ] Crear `apps/api/src/modules/auth/repositories/user.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string, tx?: Tx): Promise<User | null> {
    return (tx ?? this.prisma).user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithLocations(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        locationUsers: {
          include: { location: { include: { organization: true } } },
        },
      },
    });
  }

  async create(data: Prisma.UserCreateInput, tx?: Tx): Promise<User> {
    return (tx ?? this.prisma).user.create({ data });
  }
}
```

---

### Task 2.3: Crear Response DTOs

- [ ] Crear `apps/api/src/modules/auth/dto/auth-response.dto.ts`:

```typescript
export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: Date;

  constructor(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    isActive: boolean;
    createdAt: Date;
  }) {
    this.id = user.id;
    this.email = user.email;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.isEmailVerified = user.isEmailVerified;
    this.isActive = user.isActive;
    this.createdAt = user.createdAt;
  }
}
```

---

### Task 2.4: Refactorizar AuthService con UserRepository + refresh token rotation

- [ ] Reemplazar `apps/api/src/modules/auth/auth.service.ts` completo:

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AppConfig } from '../../config/config';
import { UserRole } from '@orderhub/types';
import {
  InvalidCredentialsError,
  TokenInvalidError,
  UserAlreadyExistsError,
} from '../../errors/auth.errors';
import { UserRepository } from './repositories/user.repository';
import { UserResponseDto } from './dto/auth-response.dto';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { AuthUser, JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AuthService {
  private readonly config: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.get<AppConfig>('app')!;
  }

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) throw new UserAlreadyExistsError(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const baseSlug = slugify(dto.businessName);

    const { user, location } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await this.userRepository.create(
        {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
        tx,
      );

      const slug = await this.uniqueSlug(baseSlug, tx);

      const org = await tx.organization.create({
        data: { name: dto.businessName, slug },
      });

      const location = await tx.location.create({
        data: { name: dto.businessName, organizationId: org.id },
      });

      await tx.organizationUser.create({
        data: { organizationId: org.id, userId: user.id, role: UserRole.ORG_ADMIN },
      });

      await tx.locationUser.create({
        data: { locationId: location.id, userId: user.id, role: UserRole.LOCATION_MANAGER },
      });

      return { user, location };
    });

    const tokens = await this.generateTokens(user.id, user.email, location.id);
    return { user: new UserResponseDto(user), tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw new InvalidCredentialsError();

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    const locationUser = await this.prisma.locationUser.findFirst({
      where: { userId: user.id },
    });
    if (!locationUser) throw new InvalidCredentialsError();

    const tokens = await this.generateTokens(user.id, user.email, locationUser.locationId);
    return { user: new UserResponseDto(user), tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string; type: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new TokenInvalidError();
    }

    if (payload.type !== 'refresh') throw new TokenInvalidError();

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: payload.jti },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new TokenInvalidError();
    }

    // Token ya fue usado — posible robo, revocar todos los tokens activos del usuario
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new TokenInvalidError();
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const locationUser = await this.prisma.locationUser.findFirst({
      where: { userId: stored.userId },
    });
    if (!locationUser) throw new TokenInvalidError();

    const tokens = await this.generateTokens(stored.userId, stored.user.email, locationUser.locationId);
    return { tokens };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    let payload: { jti: string } | null = null;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.JWT_REFRESH_SECRET,
      }) as { jti: string };
    } catch {
      return;
    }
    if (!payload) return;
    await this.prisma.refreshToken
      .update({ where: { token: payload.jti }, data: { revokedAt: new Date() } })
      .catch(() => null);
  }

  async me(authUser: AuthUser) {
    const user = await this.userRepository.findByIdWithLocations(authUser.userId);
    return new UserResponseDto(user!);
  }

  private async generateTokens(userId: string, email: string, locationId: string) {
    const jti = randomUUID();

    const accessPayload: JwtPayload = { sub: userId, email, locationId, type: 'access' };
    const accessToken = this.jwtService.sign(accessPayload as object, {
      secret: this.config.JWT_SECRET,
      expiresIn: this.config.JWT_EXPIRES_IN,
    });

    const refreshToken = this.jwtService.sign(
      { sub: userId, jti, type: 'refresh' },
      { secret: this.config.JWT_REFRESH_SECRET, expiresIn: this.config.JWT_REFRESH_EXPIRES_IN },
    );

    await this.prisma.refreshToken.create({
      data: {
        token: jti,
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  private async uniqueSlug(base: string, tx: Prisma.TransactionClient): Promise<string> {
    const existing = await tx.organization.findUnique({ where: { slug: base } });
    if (!existing) return base;
    const suffix = randomUUID().slice(0, 6);
    return `${base}-${suffix}`;
  }
}
```

---

### Task 2.5: Actualizar AuthController — ConfigService + Throttle decorators

- [ ] Reemplazar `apps/api/src/modules/auth/auth.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './strategies/jwt.strategy';
import { TokenInvalidError } from '../../errors/auth.errors';

const ACCESS_TOKEN_TTL = 15 * 60;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { user, tokens } = await this.authService.register(dto);
    this.setTokenCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { user, tokens } = await this.authService.login(dto);
    this.setTokenCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) throw new TokenInvalidError();
    const { tokens } = await this.authService.refresh(refreshToken);
    this.setTokenCookies(reply, tokens.accessToken, tokens.refreshToken);
    return {};
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const refreshToken = request.cookies?.refresh_token;
    await this.authService.logout(refreshToken);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });
    return {};
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  private setTokenCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
    reply.setCookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL,
    });
    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL,
    });
  }
}
```

---

### Task 2.6: Actualizar AuthModule — agregar UserRepository

- [ ] Reemplazar `apps/api/src/modules/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, UserRepository],
})
export class AuthModule {}
```

---

### Task 2.7: Actualizar AppModule — agregar ThrottlerModule

- [ ] Editar `apps/api/src/app.module.ts`, agregar `ThrottlerModule`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';
import { HealthController } from './health/health.controller';
import { appConfig } from './config/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '../../../.env'),
      load: [appConfig],
    }),
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 60 },
    ]),
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

---

### Task 2.8: Actualizar main.ts — agregar helmet y ConfigService

- [ ] Reemplazar `apps/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);

  await app.register(fastifyCookie as any);
  await app.register(helmet);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: configService.get<string>('WEB_URL') ?? 'http://localhost:3001',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
```

---

### Task 2.9: Verificar compilación y commit

- [ ] Verificar build de la API:

```bash
cd apps/api && pnpm build
```
Esperado: sin errores TypeScript

- [ ] Commit:

```bash
git add apps/api/src/modules/auth/repositories/user.repository.ts \
        apps/api/src/modules/auth/dto/auth-response.dto.ts \
        apps/api/src/modules/auth/auth.service.ts \
        apps/api/src/modules/auth/auth.controller.ts \
        apps/api/src/modules/auth/auth.module.ts \
        apps/api/src/app.module.ts \
        apps/api/src/main.ts \
        apps/api/package.json
git commit -m "refactor: repository pattern, response DTOs y seguridad en API (Capa 2)"
```

---

## Chunk 3: Capa 3 — Frontend

### Files

- Run: shadcn/ui init + instalar componentes
- Modify: `apps/web/package.json` (zustand)
- Create: `apps/web/src/lib/env.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/stores/auth.store.ts`
- Create: `apps/web/src/hooks/use-auth.ts`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/(auth)/register/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/app/globals.css`

---

### Task 3.1: Instalar Zustand

- [ ] Instalar zustand en apps/web:

```bash
cd apps/web && pnpm add zustand
```

---

### Task 3.2: Setup shadcn/ui

- [ ] Inicializar shadcn/ui desde apps/web:

```bash
cd apps/web && pnpm dlx shadcn@latest init
```

Opciones a seleccionar durante el init:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Esto modifica `tailwind.config.ts`, `globals.css` y crea `components.json` y `src/lib/utils.ts`.

- [ ] Instalar componentes necesarios:

```bash
cd apps/web && pnpm dlx shadcn@latest add button input label card form
```

Estos crean archivos en `src/components/ui/`.

- [ ] Verificar que `tailwind.config.ts` incluye el path a componentes ui:

El init de shadcn agrega `"./src/components/**/*.{ts,tsx}"` al content array. Verificar que quedó correctamente.

---

### Task 3.3: Crear env.ts — validación de variables de entorno en build time

- [ ] Crear `apps/web/src/lib/env.ts`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
    .optional()
    .default('http://localhost:3000/api/v1'),
  API_URL: z
    .string()
    .url()
    .optional()
    .default('http://localhost:3000/api/v1'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  API_URL: process.env.API_URL,
});
```

---

### Task 3.4: Mejorar api.ts — usar env.ts y manejar 401

- [ ] Reemplazar `apps/web/src/lib/api.ts`:

```typescript
import { env } from './env';

const IS_SERVER = typeof (globalThis as Record<string, unknown>)['window'] === 'undefined';
const API_BASE = IS_SERVER ? env.API_URL : env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  data: T;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const body = (await res.json()) as ApiResponse<T> | ApiErrorResponse;

  if (!res.ok) {
    const errBody = body as ApiErrorResponse;
    throw new ApiError(
      errBody.error?.code ?? 'UNKNOWN_ERROR',
      errBody.error?.message ?? 'Unknown error',
      res.status,
    );
  }

  return (body as ApiResponse<T>).data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

---

### Task 3.5: Crear Zustand auth store

- [ ] Crear `apps/web/src/stores/auth.store.ts`:

```typescript
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

interface AuthStore {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
```

---

### Task 3.6: Crear hook useAuth

- [ ] Crear directorio `apps/web/src/hooks/`
- [ ] Crear `apps/web/src/hooks/use-auth.ts`:

```typescript
'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { QUERY_KEYS } from '../constants/query-keys';
import { ROUTES } from '../constants/routes';
import { useAuthStore, type AuthUser } from '../stores/auth.store';

export function useAuth() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const { data, isError, isLoading } = useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: () => api.get<AuthUser>('/auth/me'),
    retry: false,
    enabled: user === null,
  });

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  useEffect(() => {
    if (isError) router.replace(ROUTES.auth.login);
  }, [isError, router]);

  return { user: user ?? data ?? null, isLoading: isLoading && user === null };
}
```

---

### Task 3.7: Actualizar login/page.tsx con componentes shadcn

- [ ] Reemplazar `apps/web/src/app/(auth)/login/page.tsx`:

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { ROUTES } from '../../../constants/routes';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  async function onSubmit(data: LoginForm) {
    try {
      const result = await api.post<{ user: Parameters<typeof setUser>[0] }>('/auth/login', data);
      setUser(result.user);
      router.push(ROUTES.dashboard.root);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'default';
      const message = t(`auth.errors.${code}`, t('auth.errors.default'));
      setError('root', { message });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.loginTitle')}</CardTitle>
        <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              {...register('email')}
              type="email"
              placeholder={t('auth.emailPlaceholder')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              {...register('password')}
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('auth.login')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link href={ROUTES.auth.register} className="text-primary hover:underline font-medium">
            {t('auth.register')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

---

### Task 3.8: Actualizar register/page.tsx con componentes shadcn

- [ ] Reemplazar `apps/web/src/app/(auth)/register/page.tsx`:

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { ROUTES } from '../../../constants/routes';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(1),
});

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) });

  async function onSubmit(data: RegisterForm) {
    try {
      const result = await api.post<{ user: Parameters<typeof setUser>[0] }>('/auth/register', data);
      setUser(result.user);
      router.push(ROUTES.dashboard.root);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'default';
      const message = t(`auth.errors.${code}`, t('auth.errors.default'));
      setError('root', { message });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.registerTitle')}</CardTitle>
        <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName">{t('auth.firstName')}</Label>
              <Input id="firstName" {...register('firstName')} type="text" />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">{t('auth.lastName')}</Label>
              <Input id="lastName" {...register('lastName')} type="text" />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="businessName">{t('auth.businessName')}</Label>
            <Input
              id="businessName"
              {...register('businessName')}
              type="text"
              placeholder={t('auth.businessNamePlaceholder')}
            />
            {errors.businessName && (
              <p className="text-xs text-destructive">{errors.businessName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              {...register('email')}
              type="email"
              placeholder={t('auth.emailPlaceholder')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              {...register('password')}
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('auth.register')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.hasAccount')}{' '}
          <Link href={ROUTES.auth.login} className="text-primary hover:underline font-medium">
            {t('auth.login')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

---

### Task 3.9: Actualizar Dashboard con useAuth

- [ ] Reemplazar `apps/web/src/app/(dashboard)/dashboard/page.tsx`:

```tsx
'use client';

import { useAuth } from '../../../hooks/use-auth';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Hola, {user.firstName}
      </h1>
      <p className="mt-1 text-muted-foreground">Dashboard — Sprint 2</p>
    </div>
  );
}
```

---

### Task 3.10: Verificar compilación y commit

- [ ] Verificar build del web:

```bash
cd apps/web && pnpm build
```
Esperado: sin errores TypeScript ni errores de shadcn

- [ ] Si hay advertencias de CSS variables de shadcn en el build, son normales — ignorar.

- [ ] Commit:

```bash
git add apps/web/src/ \
        apps/web/tailwind.config.ts \
        apps/web/components.json \
        apps/web/package.json
git commit -m "refactor: shadcn/ui, Zustand, useAuth y mejoras de arquitectura en Web (Capa 3)"
```

---

## Post-ejecución

- [ ] Actualizar `docs/TASKS.md` — marcar tareas 1.1–3.10 como ✅ completadas
- [ ] Actualizar `docs/CONTEXT.md` — reflejar nuevo estado: refactor completo, listo para Sprint 2
