// Renders a tailored_resume document as full resume HTML for preview and
// PDF download (Tailor + ATS "Full resume" mode, Resume Studio seeding).
//
// Preferred path is surgical and free: take profiles.resume_html (the
// link-preserving HTML built at base-resume upload) and swap each tailored
// bullet in place. Only when that HTML is missing or the bullets no longer
// match does it fall back to one AI formatting call.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, notFound, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateText, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import {
  RESUME_HTML_RULES,
  sanitizeResumeHtml,
  linkifyResumeHtml,
  applyChangesToHtml,
  type BulletChange,
} from '@/lib/resumeHtml'

const ROUTE = '/api/tailor-resume/render'

// The AI fallback can be slow on long resumes.
export const maxDuration = 60

interface ProfileRow {
  resume_html: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  projects: { name: string; url: string | null }[] | null
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  const validation = validateBody<{ documentId: string }>(body, ['documentId'])
  if (!validation.valid) return err(validation.error, 400)
  const { documentId } = validation.data

  const supabase = await createClient()

  const [docResult, profileResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, user_id, job_id, type, content, changes')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .eq('type', 'tailored_resume')
      .single(),
    supabase
      .from('profiles')
      .select('resume_html, linkedin_url, github_url, portfolio_url, projects')
      .eq('id', user.id)
      .single(),
  ])

  if (docResult.error || !docResult.data) {
    await logRoute(ROUTE, user.id, Date.now() - start, 404)
    return notFound('Tailored resume')
  }

  const doc = docResult.data
  const profile = (profileResult.data ?? null) as ProfileRow | null

  const changes: BulletChange[] = (Array.isArray(doc.changes) ? doc.changes : [])
    .filter(
      (c): c is BulletChange =>
        !!c && typeof c.original === 'string' && typeof c.tailored === 'string'
    )

  const knownLinks = [
    profile?.linkedin_url,
    profile?.github_url,
    profile?.portfolio_url,
    ...(profile?.projects ?? []).map((p) => p.url),
  ].filter((l): l is string => typeof l === 'string' && /^https?:\/\//i.test(l))

  // -- Surgical path: swap tailored bullets into the stored resume HTML -------
  if (profile?.resume_html && profile.resume_html.trim().startsWith('<')) {
    const { html, applied } = applyChangesToHtml(profile.resume_html, changes)
    // Good enough when every-other bullet matched; a low hit rate means the
    // stored HTML has drifted from the resume the tailoring ran against.
    if (changes.length === 0 || applied >= Math.ceil(changes.length / 2)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 200)
      return ok({
        html: linkifyResumeHtml(html, knownLinks),
        method: 'surgical',
        applied,
        total: changes.length,
      })
    }
  }

  // -- AI fallback: format the tailored text as resume HTML -------------------
  const rateLimit = await checkRateLimit({
    key: 'render-resume',
    userId: user.id,
    devLimit: 5,
    freeLimit: 10,
    proLimit: 10,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  const contactLinkLines = [
    profile?.linkedin_url && `- "LinkedIn" in the contact line -> <a href="${profile.linkedin_url}">LinkedIn</a>`,
    profile?.github_url && `- "GitHub" in the contact line -> <a href="${profile.github_url}">GitHub</a>`,
    profile?.portfolio_url && `- "Portfolio" or "Website" in the contact line -> <a href="${profile.portfolio_url}">Portfolio</a>`,
    `- Any email address -> <a href="mailto:EMAIL">EMAIL</a>`,
    `- Any raw URL in the text -> <a href="URL">display text</a>`,
  ].filter(Boolean).join('\n')

  try {
    const raw = await withTimeout(
      generateText(
        `You are a resume formatter. ${RESUME_HTML_RULES} Preserve 100% of the original content - never add, remove, or invent anything.`,
        `Convert this resume to HTML.\n\nRECONSTRUCT THESE HYPERLINKS (never invent others):\n${contactLinkLines}\n\nResume text:\n${doc.content}`,
        6000
      ),
      45000,
      'render-resume'
    )
    const cleaned = sanitizeResumeHtml(raw)
    if (!cleaned) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return err('Could not format the resume. Please try again.', 500)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({
      html: linkifyResumeHtml(cleaned, knownLinks),
      method: 'ai',
      applied: 0,
      total: changes.length,
    })
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return err(AI_BUSY_MESSAGE, 429)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
