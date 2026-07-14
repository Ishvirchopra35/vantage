// Saved job-feed filter presets: GET lists, POST creates (capped per user).
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/job-filter-presets'

// Named job-finder filter presets. `filters` is stored as-is (jsonb) so the
// jobs page can round-trip its whole Filters state, including future fields.
export interface JobFilterPreset {
  id: string
  name: string
  filters: Record<string, string>
  created_at: string
}

export async function GET(): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('job_filter_presets')
      .select('id, name, filters, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return serverError(error)
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ presets: data ?? [] })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  const validation = validateBody<{ name: string; filters: Record<string, string> }>(body, ['name', 'filters'])
  if (!validation.valid) return err(validation.error, 400)
  const { name, filters } = validation.data

  const trimmedName = name.trim()
  if (!trimmedName) return err('Preset name is required', 400)
  if (trimmedName.length > 60) return err('Preset name must be 60 characters or fewer', 400)
  if (typeof filters !== 'object' || Array.isArray(filters)) return err('filters must be an object', 400)

  try {
    const supabase = await createClient()

    // Soft cap so a single user cannot accumulate unbounded presets.
    const { count } = await supabase
      .from('job_filter_presets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count ?? 0) >= 20) return err('You can save up to 20 filter presets. Delete one first.', 400)

    const { data: preset, error } = await supabase
      .from('job_filter_presets')
      .insert({ user_id: user.id, name: trimmedName, filters })
      .select('id, name, filters, created_at')
      .single()

    if (error || !preset) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return serverError(new Error(error?.message ?? 'Failed to save preset'))
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ preset })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
