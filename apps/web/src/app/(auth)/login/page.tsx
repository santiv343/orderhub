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
