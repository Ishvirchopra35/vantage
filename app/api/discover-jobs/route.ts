import { requireAuth } from '@/lib/requireAuth'
import { logRoute } from '@/lib/logger'
import { buildUserContext } from '@/lib/userContext'
import { generateJSON } from '@/lib/ai'
import { withTimeout } from '@/lib/withTimeout'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const maxDuration = 60

const ROUTE = '/api/discover-jobs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdzunaJob {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string }
  contract_type?: string
  redirect_url: string
  description?: string
}

interface AdzunaResponse {
  results?: AdzunaJob[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const SENIOR_TERMS = ['senior', 'sr.', 'lead', 'principal', 'staff', 'head', 'director', 'manager', 'vp', 'chief']
const JUNIOR_TERMS = ['intern', 'junior', 'jr.', 'entry', 'graduate', 'associate']

function matchesSeniority(jobTitle: string, targetRoles: string[]): boolean {
  const titleLower = jobTitle.toLowerCase()
  const jobIsSenior = SENIOR_TERMS.some(t => titleLower.includes(t))
  const jobIsJunior = JUNIOR_TERMS.some(t => titleLower.includes(t))

  return targetRoles.some(role => {
    const roleLower = role.toLowerCase()
    const roleWords = roleLower.split(' ').filter(w => w.length > 3)
    const roleIsJunior = JUNIOR_TERMS.some(t => roleLower.includes(t))
    const roleIsSenior = SENIOR_TERMS.some(t => roleLower.includes(t))
    if (roleIsJunior && jobIsSenior) return false
    if (roleIsSenior && jobIsJunior) return false
    return roleWords.some(word => titleLower.includes(word))
  })
}

async function fetchAdzunaWithRetry(role: string): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID
  const apiKey = process.env.ADZUNA_API_KEY
  if (!appId || !apiKey) {
    console.error('[Adzuna] Missing credentials')
    return []
  }

  const url = new URL('https://api.adzuna.com/v1/api/jobs/ca/search/1')
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', apiKey)
  url.searchParams.set('results_per_page', '10')
  url.searchParams.set('what', role)

  const BACKOFF = [2000, 4000]

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      })

      if (res.status === 429 || res.status === 503) {
        const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)]
        console.warn(`[Adzuna] ${res.status} for "${role}", retrying in ${delay}ms (attempt ${attempt + 1})`)
        await sleep(delay)
        continue
      }

      if (!res.ok) {
        console.error(`[Adzuna] ${res.status} for "${role}"`)
        return []
      }

      const json = JSON.parse(await res.text()) as AdzunaResponse
      const results = (json.results ?? []) as AdzunaJob[]
      console.log(`[Adzuna] Fetched ${results.length} jobs for "${role}"`)
      return results
    } catch (e) {
      console.error(`[Adzuna] fetch error for "${role}":`, e)
      return []
    }
  }

  console.warn(`[Adzuna] All retries exhausted for "${role}"`)
  return []
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === 'true'

  // Only rate-limit the expensive refresh path (AI calls happen there)
  if (refresh) {
    const rateLimit = await checkRateLimit({
      key: 'discover-jobs-refresh',
      userId: user.id,
      maxRequests: 10,
      windowMinutes: 60,
    })
    if (!rateLimit.allowed) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining)
    }
  }

  const supabase = await createClient()

  // ── Cache hit — return stored jobs immediately ─────────────────────────────
  if (!refresh) {
    const { data: cached, error: cacheErr } = await supabase
      .from('job_feed_items')
      .select('id, external_job_id, source, title, company, location, url, employment_type, relevance_score, is_saved, is_dismissed, raw_data, fetched_at')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('relevance_score', { ascending: false })

    if (cacheErr) console.error('[discover-jobs] Cache read error:', cacheErr)

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return new Response(JSON.stringify({ jobs: cached ?? [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Refresh — fetch from Adzuna ────────────────────────────────────────────
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_API_KEY) {
    return new Response(JSON.stringify({ error: 'Adzuna credentials not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const ctx = await buildUserContext(user.id)
  const targetRoles = (ctx.targetRoles ?? []).filter(Boolean).slice(0, 3)

  if (targetRoles.length === 0) {
    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return new Response(JSON.stringify({ jobs: [], noTargetRoles: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Sequential fetch with 1.5s gap between roles
  const seen = new Set<string>()
  const allJobs: AdzunaJob[] = []

  for (let i = 0; i < targetRoles.length; i++) {
    const jobs = await fetchAdzunaWithRetry(targetRoles[i])
    for (const job of jobs) {
      if (!seen.has(job.id)) {
        seen.add(job.id)
        allJobs.push(job)
      }
    }
    if (i < targetRoles.length - 1) await sleep(1500)
  }

  if (allJobs[0]) console.log('[job-feed] sample job:', JSON.stringify(allJobs[0], null, 2))

  const filtered = allJobs.filter(job => matchesSeniority(job.title, targetRoles))
  console.log(`[discover-jobs] ${allJobs.length} unique → ${filtered.length} after seniority filter`)

  if (filtered.length === 0) {
    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return new Response(JSON.stringify({ jobs: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Score all jobs ─────────────────────────────────────────────────────────
  const skillsStr = (ctx.skills ?? []).join(', ') || 'Not specified'
  const rolesStr = targetRoles.join(', ')
  const systemPrompt =
    'Score job-candidate fit 0-100. Return only JSON: { "relevance_score": number, "reason": string } where reason is under 15 words.'

  const scoredJobs = await Promise.all(
    filtered.map(async job => {
      const descSnippet = (job.description ?? '').slice(0, 300)
      const userPrompt =
        `Candidate skills: ${skillsStr}. Target roles: ${rolesStr}. ` +
        `Job title: ${job.title}. Description: ${descSnippet}. Return the score.`

      let relevance_score = 50
      let reason = 'Score unavailable'

      try {
        const scored = await withTimeout(
          generateJSON<{ relevance_score: number; reason: string }>(systemPrompt, userPrompt),
          20000,
          'score-job'
        )
        relevance_score = Math.min(100, Math.max(0, Math.round(scored.relevance_score ?? 50)))
        reason = scored.reason ?? 'Good match'
      } catch (e) {
        console.warn('[discover-jobs] Score error for', job.id, ':', e)
      }

      return {
        user_id: user.id,
        external_job_id: String(job.id),
        source: 'adzuna',
        title: job.title,
        company: job.company.display_name,
        location: job.location.display_name,
        url: job.redirect_url,
        employment_type: job.contract_type ?? null,
        relevance_score,
        raw_data: { reason, description: (job.description ?? '').slice(0, 500) },
        fetched_at: new Date().toISOString(),
      }
    })
  )

  // ── Upsert (preserves is_saved / is_dismissed) ─────────────────────────────
  const { error: upsertError } = await supabase
    .from('job_feed_items')
    .upsert(scoredJobs, { onConflict: 'user_id,external_job_id' })

  if (upsertError) {
    console.warn('[discover-jobs] Upsert failed, falling back to delete+insert:', upsertError)
    const ids = scoredJobs.map(j => j.external_job_id)
    await supabase.from('job_feed_items').delete().eq('user_id', user.id).in('external_job_id', ids)
    const { error: insertError } = await supabase.from('job_feed_items').insert(scoredJobs)
    if (insertError) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // ── Return all non-dismissed items ─────────────────────────────────────────
  const { data: results } = await supabase
    .from('job_feed_items')
    .select('id, external_job_id, source, title, company, location, url, employment_type, relevance_score, is_saved, is_dismissed, raw_data, fetched_at')
    .eq('user_id', user.id)
    .eq('is_dismissed', false)
    .order('relevance_score', { ascending: false })

  await logRoute(ROUTE, user.id, Date.now() - start, 200)
  return new Response(JSON.stringify({ jobs: results ?? [] }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
