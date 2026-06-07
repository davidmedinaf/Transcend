import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { createAdminClient } from '@/lib/supabase/admin';

type UserRole = 'admin' | 'customer';

/**
 * API routes that require admin role.
 */
const ADMIN_API_ROUTES = ['/api/users', '/api/seed'];

const ADMIN_API_METHOD_ROUTES: Record<string, string[]> = {
  '/api/services': ['POST', 'PUT', 'DELETE'],
  '/api/availability': ['PUT'],
};

function isAdminApiRoute(pathname: string, method: string): boolean {
  if (ADMIN_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return true;
  }
  for (const [route, methods] of Object.entries(ADMIN_API_METHOD_ROUTES)) {
    if (pathname.startsWith(route) && methods.includes(method)) {
      return true;
    }
  }
  return false;
}

/**
 * Simplified middleware — only protects API routes.
 * Page-level auth redirects are handled client-side to avoid
 * redirect loops with Next.js 16's proxy-based middleware.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Only process API routes (excluding auth endpoints)
  if (!pathname.startsWith('/api/') || pathname.startsWith('/api/auth/')) {
    // For non-API routes and auth routes, refresh the session cookies
    const { supabase, response } = await createMiddlewareClient(request);
    await supabase.auth.getUser();
    return response;
  }

  // Public API: GET /api/services, GET /api/availability, GET /api/timeslots, GET /api/bookings
  // These pass through but still refresh the session
  if ((pathname.startsWith('/api/services') || pathname.startsWith('/api/availability') || pathname.startsWith('/api/timeslots') || pathname.startsWith('/api/bookings')) && method === 'GET') {
    const { supabase, response } = await createMiddlewareClient(request);
    // Refresh session (important for token renewal)
    await supabase.auth.getUser();
    return response;
  }

  // Protected API routes
  const { supabase, response } = await createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // Admin-only API routes: check role
  if (isAdminApiRoute(pathname, method)) {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    if (!data || data.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
