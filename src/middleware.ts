
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Define public routes that do not require authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/'];
// Define routes that authenticated users should be redirected away from
const authRoutes = ['/login', '/register', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Simulate authentication check (replace with actual logic later)
  // For now, assume no user is authenticated by default.
  // In a real app, you'd check for a valid session cookie or token.
  const isAuthenticated = false; // Replace with actual auth check logic

  const isPublicRoute = publicRoutes.includes(pathname);
  const isAuthRoute = authRoutes.includes(pathname);

  // If the user is authenticated and trying to access an auth route (login/register),
  // redirect them to a default authenticated page (e.g., /matches)
  if (isAuthenticated && isAuthRoute) {
    // TODO: Uncomment and adjust when authentication is implemented
    // return NextResponse.redirect(new URL('/matches', request.url));
  }

  // If the user is not authenticated and trying to access a protected route,
  // redirect them to the login page.
  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow the request to proceed if none of the above conditions are met
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
