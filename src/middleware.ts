
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Define public routes that do not require authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/'];
// Define routes that authenticated users should be redirected away from
const authRoutes = ['/login', '/register', '/forgot-password'];
// Define routes that require authentication
const protectedRoutes = ['/matches', '/groups', '/properties', '/profile']; // Added /profile

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('sessionToken')?.value; // Check for a session token cookie

  // Determine authentication status based on the presence of the token
  const isAuthenticated = !!sessionToken;

  const isAuthRoute = authRoutes.includes(pathname);
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Debugging logs (optional, remove in production)
  // console.log(`Middleware: Pathname=${pathname}, IsAuthenticated=${isAuthenticated}, IsAuthRoute=${isAuthRoute}, IsProtectedRoute=${isProtectedRoute}`);

  // If the user is authenticated and trying to access an auth route (login/register),
  // redirect them to the homepage (/)
  if (isAuthenticated && isAuthRoute) {
    // console.log(`Middleware: Authenticated user on auth route ${pathname}. Redirecting to /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If the user is NOT authenticated and trying to access a protected route,
  // redirect them to the login page.
  if (!isAuthenticated && isProtectedRoute) {
    // console.log(`Middleware: Unauthenticated user on protected route ${pathname}. Redirecting to /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname); // Add redirect info
    return NextResponse.redirect(loginUrl);
  }

  // Allow the request to proceed if none of the above conditions are met
  // console.log(`Middleware: Allowing request for ${pathname}`);
  return NextResponse.next();
}

// Configure the matcher to run middleware on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Health check paths (e.g., /_health)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|_health).*)',
  ],
};
