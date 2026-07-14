// Permanently deletes the caller's account. auth.users cascade removes all
// owned rows; storage files are dropped by the same cascade on objects.owner.
import { requireAuth } from '@/lib/requireAuth'
import { ok, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(_request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  try {
    const supabase = await createClient()
    await supabase.auth.signOut()

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await serviceClient.auth.admin.deleteUser(user.id)

    if (error) {
      await logRoute('/api/account/delete', user.id, Date.now() - start, 500)
      return serverError(error)
    }

    await logRoute('/api/account/delete', user.id, Date.now() - start, 200)
    return ok({ deleted: true })
  } catch (e) {
    await logRoute('/api/account/delete', user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
