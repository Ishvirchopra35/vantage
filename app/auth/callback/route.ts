// OAuth callback - Supabase redirects here after a provider (Google) sign-in
// with a one-time code that gets exchanged for a session cookie.
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = url.origin;

  // Password-reset links exchange their code here too, then land on the page
  // named by ?next=. Only allow same-origin absolute paths (no //host) so this
  // can never be turned into an open redirect.
  const nextParam = url.searchParams.get('next');
  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Most "Google didn't work" reports fail here, not at the button. Capture
    // the real reason instead of silently bouncing to /login?error=oauth.
    Sentry.captureException(error, {
      tags: { area: 'auth', flow: 'oauth-callback-exchange' },
    });
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    Sentry.captureMessage('oauth-callback: no user after code exchange', {
      level: 'error',
      tags: { area: 'auth', flow: 'oauth-callback-exchange' },
    });
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // Recovery flow: the session is now set, send them straight to set a new
  // password. Skip the OAuth onboarding branch below.
  if (safeNext) {
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // The handle_new_user trigger creates the profiles row with only id + email.
  // OAuth users never fill the signup form, so full_name comes from the
  // provider metadata. A null full_name doubles as the "first sign-in" signal.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const providerName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined);

  if (profile && !profile.full_name) {
    if (providerName) {
      await supabase
        .from('profiles')
        .update({ full_name: providerName })
        .eq('id', user.id);
    }
    // First sign-in via OAuth: send them to onboarding, same as email signup.
    return NextResponse.redirect(`${origin}/dashboard/profile?new=true`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
