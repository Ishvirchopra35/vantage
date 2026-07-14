// OAuth callback - Supabase redirects here after a provider (Google) sign-in
// with a one-time code that gets exchanged for a session cookie.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
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
