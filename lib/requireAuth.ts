import { createClient as createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';
import { unauthorized } from './apiResponse';

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
