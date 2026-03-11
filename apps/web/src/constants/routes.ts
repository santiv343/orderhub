export const ROUTES = {
  home: '/',
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    verifyEmail: '/auth/verify-email',
  },
  dashboard: {
    root: '/dashboard',
    orders: '/dashboard/orders',
    order: (id: string) => `/dashboard/orders/${id}`,
    products: '/dashboard/products',
    expenses: '/dashboard/expenses',
    dailyClose: '/dashboard/daily-close',
    reports: '/dashboard/reports',
    connectors: '/dashboard/connectors',
    settings: '/dashboard/settings',
  },
  admin: {
    root: '/admin',
    organizations: '/admin/organizations',
    users: '/admin/users',
  },
} as const;
