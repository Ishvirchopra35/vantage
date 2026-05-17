import { requireAuth } from '@/lib/requireAuth'
import { ok, err, notFound, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/job-feed/[id]'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth
  const { id } = await params

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return err('Request body must be a JSON object', 400)
  }

  const { is_saved, is_dismissed } = body as Record<string, unknown>

  const updates: Record<string, unknown> = {}
  if (typeof is_saved === 'boolean') updates.is_saved = is_saved
  if (typeof is_dismissed === 'boolean') updates.is_dismissed = is_dismissed

  if (Object.keys(updates).length === 0) {
    return err('No fields to update', 400)
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('job_feed_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, is_saved, is_dismissed')
      .single()

    if (error || !data) {
      await logRoute(ROUTE, user.id, Date.now() - start, 404)
      return notFound('Job feed item')
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ item: data })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
