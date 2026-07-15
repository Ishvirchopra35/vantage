// Session refresh helper for middleware
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session to keep it alive. Must be getUser(), not getSession():
  // getUser() validates the token with Supabase and, when the access token has
  // expired, uses the refresh token to mint a new one - and the setAll callback
  // above writes that fresh token back into the response cookies. getSession()
  // only reads the cookie, so an expired token never gets refreshed here, which
  // bounces the user between /login and /dashboard once their token ages out.
  await supabase.auth.getUser();

  return response;
}
