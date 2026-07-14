// Issues a fresh extension connection code (UUID) for the caller's profile,
// shown once in the UI and stored for Bearer auth on extension routes.
import { requireAuth } from '@/lib/requireAuth'
import { ok, serverError } from '@/lib/apiResponse'
import { createClient } from '@/lib/supabase/server'

export async function POST(_request: Request): Promise<Response> {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const token = crypto.randomUUID()
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      extension_token: token,
      extension_token_created_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return serverError(new Error(error.message))
  }

  return ok({ token })
}
