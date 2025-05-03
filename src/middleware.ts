
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Define public routes that do not require authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/'];
// Define routes that authenticated users should be redirected away from
const authRoutes = ['/login', '/register', '/forgot-password'];
// Define routes that require authentication
const protectedRoutes = ['/matches', '/groups']; // Add other protected routes here

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('sessionToken')?.value; // Example: Check for a session token cookie

  // Simulate authentication check based on the presence of a token (replace with actual validation)
  const isAuthenticated = !!sessionToken; // Basic check, replace with actual validation logic

  const isPublicRoute = publicRoutes.includes(pathname);
  const isAuthRoute = authRoutes.includes(pathname);
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route)); // Check if route starts with a protected path

  // If the user is authenticated and trying to access an auth route (login/register),
  // redirect them to the homepage (/)
  if (isAuthenticated && isAuthRoute) {
    console.log(`Authenticated user accessing auth route ${pathname}, redirecting to /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If the user is not authenticated and trying to access a protected route,
  // redirect them to the login page.
  if (!isAuthenticated && isProtectedRoute) {
    console.log(`Unauthenticated user accessing protected route ${pathname}, redirecting to /login`);
    const loginUrl = new URL('/login', request.url);
    // Optionally add a redirect query parameter
    // loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow the request to proceed if none of the above conditions are met
  // console.log(`Allowing request to ${pathname}`); // Commented out for less console noise
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
