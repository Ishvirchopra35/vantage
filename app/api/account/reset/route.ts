// Self-serve "start fresh": wipes the caller's app data but keeps the
// account, subscription (Stripe stays synced), and rate-limit history
// (so resetting is not a quota-evasion loophole).
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'

const ROUTE = '/api/account/reset'

// Deleted leaf-first so foreign keys never block a partial wipe.
const USER_DATA_TABLES = [
  'application_questions',
  'outreach_messages',
  'interview_sessions',
  'strategy_feedback',
  'ats_scores',
  'documents',
  'applications',
  'job_feed_items',
  'job_filter_presets',
  'jobs',
  'resumes',
  'events',
] as const

// Career columns cleared on profiles; identity (full_name, email, phone)
// and the extension pairing token survive the reset.
const PROFILE_RESET: Record<string, null> = {
  skills: null,
  target_roles: null,
  years_experience: null,
  university: null,
  graduation_year: null,
  linkedin_url: null,
  portfolio_url: null,
  github_url: null,
  experience: null,
  projects: null,
  resume_html: null,
  resume_pdf_path: null,
  cover_letter_template: null,
}

async function emptyStorageFolder(
  svc: SupabaseClient,
  bucket: string,
  folder: string
): Promise<void> {
  const { data: files } = await svc.storage.from(bucket).list(folder, { limit: 1000 })
  if (files && files.length > 0) {
    await svc.storage.from(bucket).remove(files.map(f => `${folder}/${f.name}`))
  }
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  const validation = validateBody<{ confirm: string }>(body, ['confirm'])
  if (!validation.valid) return err(validation.error, 400)
  if (validation.data.confirm !== 'RESET') {
    return err('Type RESET to confirm', 400)
  }

  try {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Sequential on purpose: FK order matters, and a failure mid-way should
    // stop before deleting parents of surviving children.
    for (const table of USER_DATA_TABLES) {
      const { error } = await svc.from(table).delete().eq('user_id', user.id)
      if (error) {
        await logRoute(ROUTE, user.id, Date.now() - start, 500)
        return serverError(new Error(`Reset failed on ${table}: ${error.message}`))
      }
    }

    const { error: profileError } = await svc
      .from('profiles')
      .update(PROFILE_RESET)
      .eq('id', user.id)
    if (profileError) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return serverError(new Error(`Reset failed on profiles: ${profileError.message}`))
    }

    // Storage cleanup is best-effort: orphaned files are inaccessible
    // (private buckets) and must not fail the whole reset.
    await Promise.all([
      emptyStorageFolder(svc, 'resumes', user.id).catch(() => {}),
      emptyStorageFolder(svc, 'pdfs', `tailored-resumes/${user.id}`).catch(() => {}),
    ])

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ reset: true })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
