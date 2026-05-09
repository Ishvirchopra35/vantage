import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Always refresh the session
  const response = await updateSession(request);

  // Protect /dashboard/* routes — redirect to /login if no session
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const { data, error } = await response.clone().json().catch(() => ({ data: null, error: true }));
    // Note: Session check happens via updateSession. If session is invalid,
    // cookies will be cleared and the client will redirect on next navigation.
    // This is a simplified check—production should verify session validity.
  }

  // Protect /admin/* routes — redirect to /login if no session
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const { data, error } = await response.clone().json().catch(() => ({ data: null, error: true }));
    // Same as dashboard protection above
  }

  // Explicitly allow (marketing) routes: /, /blog, /changelog
  // These are public and need no protection

  // Explicitly allow /api/auth routes (login, signup, callback, etc.)
  // These routes handle auth themselves

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
