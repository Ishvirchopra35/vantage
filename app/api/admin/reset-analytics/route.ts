// Admin-only: clears the analytics tables the /admin dashboard reads
// (events + route_logs). Real user data (profiles, applications, scores)
// and live rate-limit history are intentionally out of scope.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, notFound, serverError } from '@/lib/apiResponse'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  // Non-admins get a 404, not a 403 - the route's existence is not disclosed.
  if (!process.env.ADMIN_USER_ID || user.id !== process.env.ADMIN_USER_ID) {
    return notFound('Route')
  }

  const body = await request.json().catch(() => null)
  const validation = validateBody<{ confirm: string }>(body, ['confirm'])
  if (!validation.valid) return err(validation.error, 400)
  if (validation.data.confirm !== 'RESET ANALYTICS') {
    return err('Type RESET ANALYTICS to confirm', 400)
  }

  try {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Supabase refuses delete() without a filter; created_at >= epoch
    // matches every row.
    const [eventsResult, logsResult] = await Promise.all([
      svc.from('events').delete({ count: 'exact' }).gte('created_at', '1970-01-01'),
      svc.from('route_logs').delete({ count: 'exact' }).gte('created_at', '1970-01-01'),
    ])

    if (eventsResult.error) throw new Error(eventsResult.error.message)
    if (logsResult.error) throw new Error(logsResult.error.message)

    return ok({
      eventsDeleted: eventsResult.count ?? 0,
      routeLogsDeleted: logsResult.count ?? 0,
    })
  } catch (e) {
    return serverError(e)
  }
}
