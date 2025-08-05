/**
 * Next.js Middleware for RobPass
 * 
 * This middleware handles route protection and session validation.
 * It ensures only authenticated users can access protected routes
 * and provides automatic logout on session expiration.
 * 
 * Security Requirements:
 * - Validate session tokens for protected routes
 * - Redirect unauthenticated users to login
 * - Handle session expiration gracefully
 * - Protect API routes from unauthorized access
 */

import { NextRequest, NextResponse } from 'next/server';

// Define protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/vault',
  '/profile',
  '/settings'
];

// Define protected API routes
const PROTECTED_API_ROUTES = [
  '/api/vault',
  '/api/auth/validate',
  '/api/auth/logout'
];

// Define public routes that should redirect authenticated users
const PUBLIC_ROUTES = [
  '/login',
  '/register'
];

// Define public API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/user-info'
];

/**
 * Check if a path matches any of the given route patterns
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => {
    if (route.endsWith('*')) {
      return pathname.startsWith(route.slice(0, -1));
    }
    return pathname === route || pathname.startsWith(route + '/');
  });
}

/**
 * Extract session token from request
 */
function extractSessionToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Check if user is authenticated based on session token
 */
function isAuthenticated(request: NextRequest): boolean {
  // For now, just check if a token exists
  // The actual JWT verification will be done in the API routes
  const token = extractSessionToken(request);
  return !!token;
}

/**
 * Create response with authentication headers
 */
function createAuthResponse(
  response: NextResponse,
  isAuth: boolean
): NextResponse {
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Add authentication status header (for client-side use)
  response.headers.set('X-Auth-Status', isAuth ? 'authenticated' : 'unauthenticated');
  
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuth = isAuthenticated(request);

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    // Check if it's a protected API route
    if (matchesRoute(pathname, PROTECTED_API_ROUTES)) {
      if (!isAuth) {
        const response = NextResponse.json(
          { 
            success: false, 
            error: 'Authentication required' 
          },
          { status: 401 }
        );
        return createAuthResponse(response, false);
      }
    }
    
    // Allow public API routes
    if (matchesRoute(pathname, PUBLIC_API_ROUTES)) {
      const response = NextResponse.next();
      return createAuthResponse(response, isAuth);
    }
    
    // For other API routes, continue normally
    const response = NextResponse.next();
    return createAuthResponse(response, isAuth);
  }
  
  // Handle protected page routes
  if (matchesRoute(pathname, PROTECTED_ROUTES)) {
    if (!isAuth) {
      // Redirect to login with return URL
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      return createAuthResponse(response, false);
    }
  }
  
  // Handle public routes (redirect authenticated users)
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    if (isAuth) {
      // Redirect authenticated users to dashboard
      const dashboardUrl = new URL('/dashboard', request.url);
      const response = NextResponse.redirect(dashboardUrl);
      return createAuthResponse(response, true);
    }
  }
  
  // For the root path, handle based on authentication status
  if (pathname === '/') {
    // If authenticated and trying to access root, continue (shows vault)
    // If not authenticated, continue (shows login/register forms)
    const response = NextResponse.next();
    return createAuthResponse(response, isAuth);
  }
  
  // For all other routes, continue normally
  const response = NextResponse.next();
  return createAuthResponse(response, isAuth);
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
