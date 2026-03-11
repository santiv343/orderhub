import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_URL: z.string().url().default('http://localhost:3000'),
  WEB_URL: z.string().url().default('http://localhost:3001'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('noreply@orderhub.app'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default('test'),
  AWS_SECRET_ACCESS_KEY: z.string().default('test'),
  AWS_S3_BUCKET: z.string().default('orderhub-dev'),
  AWS_ENDPOINT_URL: z.string().optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export const appConfig = registerAs('app', () => {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
});
