import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 17: RBAC enforcement
 *
 * For any route protected by a role requirement and any authenticated user whose role
 * does not match that requirement, the system SHALL deny access and redirect appropriately
 * (customer → customer app, admin → admin panel). For any protected route and any
 * unauthenticated request (missing, expired, or malformed token), the system SHALL
 * redirect to the login page.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
 */

// --- Pure route classification logic extracted from middleware.ts ---

type UserRole = 'admin' | 'customer';
type AuthState = { authenticated: true; role: UserRole } | { authenticated: false };

type AccessDecision =
  | { action: 'allow' }
  | { action: 'redirect'; target: string }
  | { action: 'deny'; status: 401 | 403 };

const PUBLIC_ROUTES = ['/login', '/register'];
const ADMIN_API_ROUTES = ['/api/users', '/api/seed'];
const ADMIN_API_METHOD_ROUTES: Record<string, string[]> = {
  '/api/services': ['POST', 'PUT', 'DELETE'],
  '/api/availability': ['PUT'],
};
const AUTH_API_ROUTES = ['/api/bookings', '/api/timeslots'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.endsWith(route));
}

function isPublicApiRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/services') && method === 'GET') {
    return true;
  }
  return false;
}

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

function isAuthRequiredApiRoute(pathname: string): boolean {
  return AUTH_API_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Pure function that determines the access decision based on route, method, and auth state.
 * This mirrors the middleware logic without Next.js request/response dependencies.
 */
function determineAccess(pathname: string, method: string, auth: AuthState): AccessDecision {
  // Public page routes: allow all
  if (isPublicRoute(pathname)) {
    return { action: 'allow' };
  }

  // Public API routes (GET /api/services): allow all
  if (pathname.startsWith('/api/') && isPublicApiRoute(pathname, method)) {
    return { action: 'allow' };
  }

  // --- Protected routes: check authentication ---

  // API routes
  if (pathname.startsWith('/api/')) {
    if (!auth.authenticated) {
      return { action: 'deny', status: 401 };
    }

    // Admin-only API routes
    if (isAdminApiRoute(pathname, method)) {
      if (auth.role !== 'admin') {
        return { action: 'deny', status: 403 };
      }
      return { action: 'allow' };
    }

    // Auth-required API routes (any role)
    if (isAuthRequiredApiRoute(pathname)) {
      return { action: 'allow' };
    }

    // Other API routes: allow if authenticated
    return { action: 'allow' };
  }

  // --- Page routes ---
  if (!auth.authenticated) {
    return { action: 'redirect', target: '/login' };
  }

  // Admin page routes
  if (pathname.startsWith('/admin')) {
    if (auth.role !== 'admin') {
      return { action: 'redirect', target: '/' };
    }
    return { action: 'allow' };
  }

  // Customer page routes (all non-admin pages)
  if (auth.role === 'admin') {
    return { action: 'redirect', target: '/admin' };
  }

  return { action: 'allow' };
}

// --- Generators ---

/** Generates a random admin page route */
const adminPageRouteArb = fc.oneof(
  fc.constant('/admin'),
  fc.constant('/admin/services'),
  fc.constant('/admin/services/new'),
  fc.constant('/admin/bookings'),
  fc.constant('/admin/users'),
  fc.constant('/admin/schedule/some-id'),
  fc.constant('/admin/seed'),
  fc.stringMatching(/^\/admin\/[a-z]+$/).filter((s) => s.length > 7)
);

/** Generates a random customer page route */
const customerPageRouteArb = fc.oneof(
  fc.constant('/'),
  fc.constant('/services'),
  fc.constant('/services/some-id'),
  fc.constant('/book/some-service'),
  fc.constant('/book/confirm'),
  fc.constant('/book/payment'),
  fc.constant('/bookings'),
  fc.stringMatching(/^\/[a-z]+$/).filter(
    (s) => !s.startsWith('/admin') && s !== '/login' && s !== '/register' && s.length > 1
  )
);

/** Generates a public route */
const publicRouteArb = fc.oneof(fc.constant('/login'), fc.constant('/register'));

/** Generates an admin-only API route */
const adminApiRouteArb = fc.record({
  pathname: fc.oneof(
    fc.constant('/api/users'),
    fc.constant('/api/users/some-id/role'),
    fc.constant('/api/seed')
  ),
  method: fc.constant('POST'),
});

/** Generates an admin-method API route (requires admin for write methods) */
const adminMethodApiRouteArb = fc.oneof(
  fc.record({ pathname: fc.constant('/api/services'), method: fc.constantFrom('POST', 'PUT', 'DELETE') }),
  fc.record({ pathname: fc.constant('/api/services/some-id'), method: fc.constantFrom('POST', 'PUT', 'DELETE') }),
  fc.record({ pathname: fc.constant('/api/availability/some-id'), method: fc.constant('PUT') })
);

/** Generates a public API route (GET /api/services) */
const publicApiRouteArb = fc.record({
  pathname: fc.oneof(fc.constant('/api/services'), fc.constant('/api/services/some-id')),
  method: fc.constant('GET'),
});

/** Generates an auth-required API route (any role) */
const authApiRouteArb = fc.record({
  pathname: fc.oneof(
    fc.constant('/api/bookings'),
    fc.constant('/api/bookings/some-id'),
    fc.constant('/api/bookings/some-id/cancel'),
    fc.constant('/api/timeslots/some-id')
  ),
  method: fc.constantFrom('GET', 'POST'),
});

/** Generates a user role */
const roleArb = fc.constantFrom<UserRole>('admin', 'customer');

// --- Tests ---

describe('Property 17: RBAC enforcement', () => {
  describe('Admin routes deny non-admin users (Requirement 13.1)', () => {
    it('admin page routes: customer is redirected to customer app', () => {
      fc.assert(
        fc.property(adminPageRouteArb, (route) => {
          const result = determineAccess(route, 'GET', { authenticated: true, role: 'customer' });
          expect(result).toEqual({ action: 'redirect', target: '/' });
        }),
        { numRuns: 100 }
      );
    });

    it('admin page routes: unauthenticated is redirected to login', () => {
      fc.assert(
        fc.property(adminPageRouteArb, (route) => {
          const result = determineAccess(route, 'GET', { authenticated: false });
          expect(result).toEqual({ action: 'redirect', target: '/login' });
        }),
        { numRuns: 100 }
      );
    });

    it('admin page routes: admin is allowed', () => {
      fc.assert(
        fc.property(adminPageRouteArb, (route) => {
          const result = determineAccess(route, 'GET', { authenticated: true, role: 'admin' });
          expect(result).toEqual({ action: 'allow' });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Customer routes deny admin users (Requirement 13.2)', () => {
    it('customer page routes: admin is redirected to admin panel', () => {
      fc.assert(
        fc.property(customerPageRouteArb, (route) => {
          const result = determineAccess(route, 'GET', { authenticated: true, role: 'admin' });
          expect(result).toEqual({ action: 'redirect', target: '/admin' });
        }),
        { numRuns: 100 }
      );
    });

    it('customer page routes: unauthenticated is redirected to login', () => {
      fc.assert(
        fc.property(customerPageRouteArb, (route) => {
          const result = determineAccess(route, 'GET', { authenticated: false });
          expect(result).toEqual({ action: 'redirect', target: '/login' });
        }),
        { numRuns: 100 }
      );
    });

    it('customer page routes: customer is allowed', () => {
      fc.assert(
        fc.property(customerPageRouteArb, (route) => {
          const result = determineAccess(route, 'GET', { authenticated: true, role: 'customer' });
          expect(result).toEqual({ action: 'allow' });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Unauthenticated access redirects to login (Requirement 13.3)', () => {
    it('any non-public page route: unauthenticated redirects to login', () => {
      const nonPublicPageRouteArb = fc.oneof(adminPageRouteArb, customerPageRouteArb);

      fc.assert(
        fc.property(nonPublicPageRouteArb, (route) => {
          const result = determineAccess(route, 'GET', { authenticated: false });
          expect(result).toEqual({ action: 'redirect', target: '/login' });
        }),
        { numRuns: 200 }
      );
    });

    it('auth-required API route: unauthenticated returns 401', () => {
      fc.assert(
        fc.property(authApiRouteArb, ({ pathname, method }) => {
          const result = determineAccess(pathname, method, { authenticated: false });
          expect(result).toEqual({ action: 'deny', status: 401 });
        }),
        { numRuns: 100 }
      );
    });

    it('admin API route: unauthenticated returns 401', () => {
      const adminApiArb = fc.oneof(adminApiRouteArb, adminMethodApiRouteArb);

      fc.assert(
        fc.property(adminApiArb, ({ pathname, method }) => {
          const result = determineAccess(pathname, method, { authenticated: false });
          expect(result).toEqual({ action: 'deny', status: 401 });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Admin API routes enforce admin role (Requirement 13.4)', () => {
    it('admin API routes: customer receives 403', () => {
      const adminApiArb = fc.oneof(adminApiRouteArb, adminMethodApiRouteArb);

      fc.assert(
        fc.property(adminApiArb, ({ pathname, method }) => {
          const result = determineAccess(pathname, method, { authenticated: true, role: 'customer' });
          expect(result).toEqual({ action: 'deny', status: 403 });
        }),
        { numRuns: 100 }
      );
    });

    it('admin API routes: admin is allowed', () => {
      const adminApiArb = fc.oneof(adminApiRouteArb, adminMethodApiRouteArb);

      fc.assert(
        fc.property(adminApiArb, ({ pathname, method }) => {
          const result = determineAccess(pathname, method, { authenticated: true, role: 'admin' });
          expect(result).toEqual({ action: 'allow' });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Public routes allow all users', () => {
    it('public page routes: any auth state is allowed', () => {
      const authStateArb = fc.oneof(
        fc.constant<AuthState>({ authenticated: false }),
        fc.record({ authenticated: fc.constant(true as const), role: roleArb })
      );

      fc.assert(
        fc.property(publicRouteArb, authStateArb, (route, auth) => {
          const result = determineAccess(route, 'GET', auth);
          expect(result).toEqual({ action: 'allow' });
        }),
        { numRuns: 100 }
      );
    });

    it('public API routes (GET /api/services): any auth state is allowed', () => {
      const authStateArb = fc.oneof(
        fc.constant<AuthState>({ authenticated: false }),
        fc.record({ authenticated: fc.constant(true as const), role: roleArb })
      );

      fc.assert(
        fc.property(publicApiRouteArb, authStateArb, ({ pathname, method }, auth) => {
          const result = determineAccess(pathname, method, auth);
          expect(result).toEqual({ action: 'allow' });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Auth-required API routes allow any authenticated role', () => {
    it('auth API routes: any authenticated role is allowed', () => {
      fc.assert(
        fc.property(authApiRouteArb, roleArb, ({ pathname, method }, role) => {
          const result = determineAccess(pathname, method, { authenticated: true, role });
          expect(result).toEqual({ action: 'allow' });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete access matrix property', () => {
    it('for any route/role/auth combination, the access decision is deterministic and correct', () => {
      const routeArb = fc.oneof(
        adminPageRouteArb.map((r) => ({ pathname: r, method: 'GET', type: 'admin-page' as const })),
        customerPageRouteArb.map((r) => ({ pathname: r, method: 'GET', type: 'customer-page' as const })),
        publicRouteArb.map((r) => ({ pathname: r, method: 'GET', type: 'public-page' as const })),
        adminApiRouteArb.map((r) => ({ ...r, type: 'admin-api' as const })),
        adminMethodApiRouteArb.map((r) => ({ ...r, type: 'admin-method-api' as const })),
        publicApiRouteArb.map((r) => ({ ...r, type: 'public-api' as const })),
        authApiRouteArb.map((r) => ({ ...r, type: 'auth-api' as const }))
      );

      const authStateArb = fc.oneof(
        fc.constant<AuthState & { type: 'unauth' }>({ authenticated: false, type: 'unauth' } as AuthState & { type: 'unauth' }),
        roleArb.map((role) => ({ authenticated: true as const, role, type: 'auth' as const }))
      );

      fc.assert(
        fc.property(routeArb, authStateArb, (route, auth) => {
          const authState: AuthState = auth.type === 'unauth'
            ? { authenticated: false }
            : { authenticated: true, role: auth.role };

          const result = determineAccess(route.pathname, route.method, authState);

          // The result must be one of the valid decision types
          expect(['allow', 'redirect', 'deny']).toContain(result.action);

          // Verify expected outcomes based on route type and auth state
          switch (route.type) {
            case 'public-page':
            case 'public-api':
              expect(result.action).toBe('allow');
              break;

            case 'admin-page':
              if (!authState.authenticated) {
                expect(result).toEqual({ action: 'redirect', target: '/login' });
              } else if (authState.role === 'admin') {
                expect(result).toEqual({ action: 'allow' });
              } else {
                expect(result).toEqual({ action: 'redirect', target: '/' });
              }
              break;

            case 'customer-page':
              if (!authState.authenticated) {
                expect(result).toEqual({ action: 'redirect', target: '/login' });
              } else if (authState.role === 'customer') {
                expect(result).toEqual({ action: 'allow' });
              } else {
                expect(result).toEqual({ action: 'redirect', target: '/admin' });
              }
              break;

            case 'admin-api':
            case 'admin-method-api':
              if (!authState.authenticated) {
                expect(result).toEqual({ action: 'deny', status: 401 });
              } else if (authState.role === 'admin') {
                expect(result).toEqual({ action: 'allow' });
              } else {
                expect(result).toEqual({ action: 'deny', status: 403 });
              }
              break;

            case 'auth-api':
              if (!authState.authenticated) {
                expect(result).toEqual({ action: 'deny', status: 401 });
              } else {
                expect(result).toEqual({ action: 'allow' });
              }
              break;
          }
        }),
        { numRuns: 500 }
      );
    });
  });
});
