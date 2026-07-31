// Job feed: pulls matching postings from Adzuna into job_feed_items and
// serves the stored feed. Refreshes are rate-limited per user.
import { requireAuth } from '@/lib/requireAuth'
import { logRoute } from '@/lib/logger'
import { buildUserContext } from '@/lib/userContext'
import { generateJSON } from '@/lib/ai'
import { withTimeout } from '@/lib/withTimeout'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse, recordRateLimitUse, checkSharedQuota, incrementSharedQuota } from '@/lib/rateLimit'

export const maxDuration = 60

const ROUTE = '/api/discover-jobs'

// --- Types --------------------------------------------------------------------

interface AdzunaJob {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string }
  contract_type?: string
  redirect_url: string
  description?: string
  created?: string
  salary_min?: number | null
  salary_max?: number | null
}

interface AdzunaResponse {
  results?: AdzunaJob[]
}

// --- Helpers ------------------------------------------------------------------

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

// Server-side filters forwarded to Adzuna. These cannot be applied client-side
// because they change which jobs Adzuna returns in the first place.
interface AdzunaFilters {
  salaryMin?: number
  maxDaysOld?: number
  jobType?: string
}

async function fetchAdzunaWithRetry(role: string, filters: AdzunaFilters): Promise<AdzunaJob[]> {
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

  if (filters.salaryMin && filters.salaryMin > 0) {
    url.searchParams.set('salary_min', String(filters.salaryMin))
  }
  if (filters.maxDaysOld && filters.maxDaysOld > 0) {
    url.searchParams.set('max_days_old', String(filters.maxDaysOld))
  }
  // Adzuna has no internship flag - internships stay a client-side title filter.
  if (filters.jobType === 'full-time') url.searchParams.set('full_time', '1')
  if (filters.jobType === 'part-time') url.searchParams.set('part_time', '1')
  if (filters.jobType === 'contract') url.searchParams.set('contract', '1')

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

// Note on job links: Adzuna's API only exposes redirect_url (their tracked
// land page); the employer's direct URL is not in the API and Adzuna's site
// serves 403 to server-side fetches, so it cannot be resolved from here.
// redirect_url forwards real browsers to the source posting when possible.

// --- Route --------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === 'true'

  // Optional server-side filters (only meaningful on refresh)
  const parseNum = (v: string | null): number | undefined => {
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const filters: AdzunaFilters = {
    salaryMin: parseNum(searchParams.get('salaryMin')),
    maxDaysOld: parseNum(searchParams.get('maxDaysOld')),
    jobType: searchParams.get('jobType')?.trim() || undefined,
  }

  // Only rate-limit the expensive refresh path (AI calls happen there)
  if (refresh) {
    const rateLimit = await checkRateLimit({
      key: 'discover-jobs-refresh',
      userId: user.id,
      devLimit: 1,
      freeLimit: 3,
      proLimit: 30,
      devWindowMinutes: 1440,
      freeWindowMinutes: 43200,
      proWindowMinutes: 43200,
    })
    if (!rateLimit.allowed) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
    }
  }

  const supabase = await createClient()

  // -- Cache hit - return stored jobs immediately -----------------------------
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

  // -- Refresh - fetch from Adzuna --------------------------------------------
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_API_KEY) {
    return new Response(JSON.stringify({ error: 'Adzuna credentials not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Platform-wide Adzuna budget: the free tier allows 1000 calls/month and
  // each refresh burns up to 3 (one per target role). 900 leaves headroom.
  const adzunaQuota = await checkSharedQuota('adzuna_monthly', 900, 30)
  if (!adzunaQuota.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return new Response(
      JSON.stringify({ error: 'The job feed is temporarily at capacity. Your saved feed still works - try refreshing again in a few days.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
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
    const jobs = await fetchAdzunaWithRetry(targetRoles[i], filters)
    // Charge the shared Adzuna budget per role fetched (counting failed
    // attempts too keeps the estimate conservative).
    void incrementSharedQuota('adzuna_monthly').catch(() => {})
    for (const job of jobs) {
      if (!seen.has(job.id)) {
        seen.add(job.id)
        allJobs.push(job)
      }
    }
    if (i < targetRoles.length - 1) await sleep(1500)
  }


  const filtered = allJobs.filter(job => matchesSeniority(job.title, targetRoles))
  console.log(`[discover-jobs] ${allJobs.length} unique → ${filtered.length} after seniority filter`)

  if (filtered.length === 0) {
    // The refresh ran (Adzuna was called) even though nothing matched - charge it.
    await Promise.all([
      recordRateLimitUse('discover-jobs-refresh', user.id),
      logRoute(ROUTE, user.id, Date.now() - start, 200),
    ])
    return new Response(JSON.stringify({ jobs: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // -- Score all jobs in ONE model call ----------------------------------------
  // One batched request instead of one per job: a feed refresh used to fire
  // 20-30 parallel Gemini calls, which alone exhausted the free tier's daily
  // quota and 500'd every other AI feature. Scoring failures degrade to a
  // neutral 50 - the feed must never break because scoring did.
  const skillsStr = (ctx.skills ?? []).join(', ') || 'Not specified'
  const rolesStr = targetRoles.join(', ')

  const scoreMap = new Map<string, { relevance_score: number; reason: string }>()
  try {
    const systemPrompt =
      'You score job-candidate fit. Return ONLY a JSON array, one entry per job: ' +
      '[{ "id": string, "relevance_score": number 0-100, "reason": string under 15 words }]. ' +
      'Every job id from the input must appear exactly once.'
    const jobsForPrompt = filtered.map(job => ({
      id: String(job.id),
      title: job.title,
      description: (job.description ?? '').slice(0, 250),
    }))
    const userPrompt =
      `Candidate skills: ${skillsStr}. Target roles: ${rolesStr}.\n\n` +
      `Jobs to score:\n${JSON.stringify(jobsForPrompt)}`

    const scored = await withTimeout(
      generateJSON<Array<{ id: string; relevance_score: number; reason: string }>>(
        systemPrompt,
        userPrompt,
        4000
      ),
      30000,
      'score-jobs-batch'
    )
    for (const entry of Array.isArray(scored) ? scored : []) {
      if (!entry || typeof entry.id !== 'string') continue
      scoreMap.set(entry.id, {
        relevance_score: Math.min(100, Math.max(0, Math.round(entry.relevance_score ?? 50))),
        reason: typeof entry.reason === 'string' ? entry.reason : 'Good match',
      })
    }
  } catch (e) {
    console.warn('[discover-jobs] Batch scoring failed, using neutral scores:', e)
  }

  const scoredJobs = filtered.map(job => {
    const score = scoreMap.get(String(job.id))
    return {
      user_id: user.id,
      external_job_id: String(job.id),
      source: 'adzuna',
      title: job.title,
      company: job.company.display_name,
      location: job.location.display_name,
      url: job.redirect_url,
      employment_type: job.contract_type ?? null,
      relevance_score: score?.relevance_score ?? 50,
      // posted_at + salary bounds feed the client-side "Posted" and
      // "Min salary" filters on the jobs page.
      raw_data: {
        reason: score?.reason ?? 'Score unavailable',
        description: (job.description ?? '').slice(0, 500),
        posted_at: job.created ?? null,
        salary_min: job.salary_min ?? null,
        salary_max: job.salary_max ?? null,
      },
      fetched_at: new Date().toISOString(),
    }
  })

  // -- Upsert (preserves is_saved / is_dismissed) -----------------------------
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

  // -- Return all non-dismissed items -----------------------------------------
  const { data: results } = await supabase
    .from('job_feed_items')
    .select('id, external_job_id, source, title, company, location, url, employment_type, relevance_score, is_saved, is_dismissed, raw_data, fetched_at')
    .eq('user_id', user.id)
    .eq('is_dismissed', false)
    .order('relevance_score', { ascending: false })

  // Charge the refresh only now that the feed actually updated.
  await Promise.all([
    recordRateLimitUse('discover-jobs-refresh', user.id),
    logRoute(ROUTE, user.id, Date.now() - start, 200),
  ])
  return new Response(JSON.stringify({ jobs: results ?? [] }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
