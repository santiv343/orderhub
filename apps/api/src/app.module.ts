import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { appConfig } from './config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: (config) => {
        const result = appConfig.VALIDATION_SCHEMA?.safeParse(config);
        if (result && !result.success) {
          throw new Error(`Config validation error: ${result.error.message}`);
        }
        return config;
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
