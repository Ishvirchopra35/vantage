// Updates the caller's profile row (server-validated variant of the form).
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json()
  const validation = validateBody<{ full_name: string }>(body, ['full_name'])
  if (!validation.valid) return err(validation.error, 400)
  const { full_name } = validation.data

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: full_name.trim() })
      .eq('id', user.id)

    if (error) {
      await logRoute('/api/profile/update', user.id, Date.now() - start, 500)
      return serverError(error)
    }

    await logRoute('/api/profile/update', user.id, Date.now() - start, 200)
    return ok({ updated: true })
  } catch (e) {
    await logRoute('/api/profile/update', user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
