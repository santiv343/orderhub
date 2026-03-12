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
