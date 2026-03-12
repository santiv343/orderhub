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
