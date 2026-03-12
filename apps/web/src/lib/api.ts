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
