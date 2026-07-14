// SERVER-SIDE ONLY - auth guard for API routes.
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';
import { unauthorized } from './apiResponse';

/**
 * Resolves the authenticated user from the request's session cookie.
 * Returns `{ user }` on success or `{ error }` holding a ready-made 401
 * Response - callers do `if ('error' in auth) return auth.error`.
 */
export async function requireAuth(): Promise<{ user: User } | { error: ReturnType<typeof unauthorized> }> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return { error: unauthorized() };
    }

    return { user: data.user };
  } catch (e) {
    return { error: unauthorized() };
  }
}

export default requireAuth;
