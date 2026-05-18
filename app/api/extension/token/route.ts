import { requireAuth } from '@/lib/requireAuth'
import { ok, serverError } from '@/lib/apiResponse'
import { createClient } from '@/lib/supabase/server'

export async function POST(_request: Request): Promise<Response> {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const token = crypto.randomUUID()
  const supabase = await createClient()

  console.error('[extension/token] Saving token for user:', user.id, '| token length:', token.length)

  const { error } = await supabase
    .from('profiles')
    .update({
      extension_token: token,
      extension_token_created_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('[extension/token] Supabase update error:', error.message)
    return serverError(new Error(error.message))
  }

  // Confirm the token was actually written
  const { data: verify, error: verifyError } = await supabase
    .from('profiles')
    .select('extension_token')
    .eq('id', user.id)
    .single()

  console.error('[extension/token] Verify read error:', verifyError?.message ?? 'none')
  console.error('[extension/token] Stored token matches:', verify?.extension_token === token)

  return ok({ token })
}
