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
