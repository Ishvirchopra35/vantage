// Rename or delete one saved job-feed filter preset (user-scoped).
import { requireAuth } from '@/lib/requireAuth'
import { notFound, serverError } from '@/lib/apiResponse'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth
  const { id } = await params

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('job_filter_presets')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) return notFound('Preset')

    const { error } = await supabase
      .from('job_filter_presets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return serverError(new Error(error.message))

    return new Response(null, { status: 204 })
  } catch (e) {
    return serverError(e)
  }
}
