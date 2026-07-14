// Update or delete one saved application-question answer (user-scoped).
import { requireAuth } from '@/lib/requireAuth'
import { ok, err, notFound, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/answer-question/[id]'

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
  const { user_edited_answer } = body as Record<string, unknown>
  if (typeof user_edited_answer !== 'string') {
    return err('Missing required field: user_edited_answer', 400)
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('application_questions')
      .update({ user_edited_answer })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, user_edited_answer')
      .single()

    if (error || !data) {
      await logRoute(ROUTE, user.id, Date.now() - start, 404)
      return notFound('Question')
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ question: data })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
