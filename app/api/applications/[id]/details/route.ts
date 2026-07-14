// Read one application with its linked job, documents, and ATS score.
import { requireAuth } from '@/lib/requireAuth'
import { ok, notFound, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth
  const { id } = await params

  try {
    const supabase = await createClient()

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, user_id, job_id, company, role, job_url, status, applied_date, resume_doc_id, cover_letter_doc_id, ats_score_id, notes, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (appError || !application) {
      await logRoute('/api/applications/[id]/details', user.id, Date.now() - start, 404)
      return notFound('Application')
    }

    interface TailorChange {
      section: string
      entry: string
      original: string
      tailored: string
      reason: string
    }

    let documents: Array<{
      id: string
      type: string
      content: string | null
      changes: TailorChange[] | null
      skill_gaps: string[] | null
      created_at: string
    }> = []
    let atsScore = null

    if (application.job_id) {
      const [docsResult, atsResult] = await Promise.all([
        supabase
          .from('documents')
          .select('id, type, content, changes, skill_gaps, created_at')
          .eq('job_id', application.job_id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('ats_scores')
          .select('id, overall_score, keyword_score, format_score, experience_score, skills_score, missing_keywords, present_keywords, suggestions')
          .eq('job_id', application.job_id)
          .eq('user_id', user.id)
          // ats_scores has scored_at, not created_at - ordering by a missing
          // column errors the query and the modal never shows a score.
          .order('scored_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (docsResult.data) {
        // The full tailored-resume text is internal-only (ATS scoring,
        // auto-fill). Users only ever see the per-bullet diff, so the raw
        // content is stripped here before it leaves the server.
        documents = docsResult.data.map((doc) =>
          doc.type === 'tailored_resume' ? { ...doc, content: null } : doc
        )
      }
      if (atsResult.data) atsScore = atsResult.data
    }

    await logRoute('/api/applications/[id]/details', user.id, Date.now() - start, 200)
    return ok({ application, documents, atsScore })
  } catch (e) {
    await logRoute('/api/applications/[id]/details', user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
