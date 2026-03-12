import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTES } from './constants/routes';

const PUBLIC_PATHS = [ROUTES.auth.login, ROUTES.auth.register];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has('access_token');
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasToken && !isPublicPath) {
    return NextResponse.redirect(new URL(ROUTES.auth.login, request.url));
  }

  if (hasToken && isPublicPath) {
    return NextResponse.redirect(new URL(ROUTES.dashboard.root, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
