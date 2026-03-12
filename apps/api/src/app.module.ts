import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
