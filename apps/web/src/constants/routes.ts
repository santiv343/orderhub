export const ROUTES = {
  home: '/',
  auth: {
    login: '/login',
    register: '/register',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    verifyEmail: '/verify-email',
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
