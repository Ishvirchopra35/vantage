import { requireAuth } from '@/lib/requireAuth'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { buildUserContext } from '@/lib/userContext'
import { generateJSON } from '@/lib/ai'
import { withTimeout } from '@/lib/withTimeout'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/discover-jobs'

// ─── Adzuna ───────────────────────────────────────────────────────────────────

interface AdzunaJob {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string }
  contract_type?: string
  redirect_url: string
  description?: string
  salary_min?: number
  salary_max?: number
  created?: string
}

interface AdzunaResponse {
  results?: AdzunaJob[]
}

async function fetchAdzunaJobs(role: string): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID
  const apiKey = process.env.ADZUNA_API_KEY

  if (!appId || !apiKey) {
    console.error('[Adzuna] Missing credentials: ADZUNA_APP_ID or ADZUNA_APP_KEY is empty')
    return []
  }

  try {
    const url = new URL('https://api.adzuna.com/v1/api/jobs/ca/search/1')
    url.searchParams.set('app_id', appId)
    url.searchParams.set('app_key', apiKey)
    url.searchParams.set('results_per_page', '20')
    url.searchParams.set('what', role)

    console.log(`[Adzuna] Fetching jobs for role: "${role}"`)
    console.log(`[Adzuna] Request URL: ${url.toString()}`)

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    })

    const responseText = await res.text()

    if (!res.ok) {
      console.error(`[Adzuna] Fetch failed with status ${res.status} for role "${role}"`)
      console.error(`[Adzuna] Response body: ${responseText}`)
      return []
    }

    let json: AdzunaResponse
    try {
      json = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`[Adzuna] Failed to parse JSON response: ${responseText}`)
      console.error(`[Adzuna] Parse error: ${parseError}`)
      return []
    }

    const results = (json.results ?? []) as AdzunaJob[]
    console.log(`[Adzuna] Successfully fetched ${results.length} jobs for role "${role}"`)
    return results
  } catch (error) {
    console.error(`[Adzuna] Fetch error for role "${role}":`, error)
    return []
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    console.log('[discover-jobs] Route called');
    const start = Date.now()

    console.log('[discover-jobs] Checking auth...');
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user } = auth
    console.log('[discover-jobs] Auth OK for user:', user.id);

    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    const supabase = await createClient()

    // ── Validate Adzuna credentials first ──────────────────────────────────────────
    const appId = process.env.ADZUNA_APP_ID
    const apiKey = process.env.ADZUNA_API_KEY
    
    console.log('[discover-jobs] appId:', appId ? 'present' : 'missing')
    console.log('[discover-jobs] apiKey:', apiKey ? 'present' : 'missing')
    
    if (!appId || !apiKey) {
      console.error('[discover-jobs] API credentials not configured')
      return new Response(JSON.stringify({ error: 'Adzuna API credentials not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[discover-jobs] About to call buildUserContext...');
    const ctx = await buildUserContext(user.id)
    console.log('[discover-jobs] buildUserContext returned');
    const targetRoles = (ctx.targetRoles ?? []).filter(Boolean).slice(0, 3)

    console.log('[discover-jobs] targetRoles:', targetRoles);

    if (targetRoles.length === 0) {
      await logRoute(ROUTE, user.id, Date.now() - start, 200)
      return new Response(JSON.stringify({ jobs: [], noTargetRoles: true }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }

    console.log('[discover-jobs] Fetching from Adzuna for roles:', targetRoles);
    const roleResults = await Promise.all(targetRoles.map(role => fetchAdzunaJobs(role)))

    const seen = new Set<string>()
    const allJobs: AdzunaJob[] = []
    for (const jobs of roleResults) {
      for (const job of jobs) {
        if (!seen.has(job.id)) {
          seen.add(job.id)
          allJobs.push(job)
        }
      }
    }

    console.log('[discover-jobs] Got', allJobs.length, 'unique jobs');

    if (allJobs.length === 0) {
      await logRoute(ROUTE, user.id, Date.now() - start, 200)
      return new Response(JSON.stringify({ jobs: [] }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' },
      })
    }

    // ── Score all jobs in parallel ───────────────────────────────────────────
    const skillsStr = (ctx.skills ?? []).join(', ') || 'Not specified'
    const rolesStr = targetRoles.join(', ')

    const systemPrompt =
      'Score job-candidate fit 0-100. Return only JSON: { "relevance_score": number, "reason": string } where reason is under 15 words.'

    console.log('[discover-jobs] Scoring', allJobs.length, 'jobs...');
    const scoredJobs = await Promise.all(
      allJobs.map(async (job) => {
        const descSnippet = (job.description ?? '').slice(0, 300)
        const userPrompt =
          `Candidate skills: ${skillsStr}. Target roles: ${rolesStr}. ` +
          `Job title: ${job.title}. Key skills required: ${descSnippet}. Return the score.`

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
          console.warn('[discover-jobs] Score error for job', job.id, ':', e);
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

    console.log('[discover-jobs] Scored', scoredJobs.length, 'jobs, upserting...');

    // ── Upsert (preserves is_saved / is_dismissed) ───────────────────────────
    // REQUIRES unique constraint: job_feed_items_user_external_unique on (user_id, external_job_id)
    // If constraint doesn't exist, run: ALTER TABLE job_feed_items ADD CONSTRAINT job_feed_items_user_external_unique UNIQUE (user_id, external_job_id);
    
    const { error: upsertError } = await supabase
      .from('job_feed_items')
      .upsert(scoredJobs, { onConflict: 'user_id,external_job_id' })

    if (upsertError) {
      // If the unique constraint doesn't exist, try delete + insert fallback
      console.warn('[discover-jobs] Upsert failed, trying delete+insert fallback:', upsertError);
      
      // Delete old entries for these jobs
      const externalJobIds = scoredJobs.map(j => j.external_job_id);
      const { error: deleteError } = await supabase
        .from('job_feed_items')
        .delete()
        .eq('user_id', user.id)
        .in('external_job_id', externalJobIds);
      
      if (deleteError) {
        await logRoute(ROUTE, user.id, Date.now() - start, 500)
        console.error('[discover-jobs] Delete error:', deleteError);
        return new Response(JSON.stringify({ error: 'Database delete failed', details: String(deleteError) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      
      // Insert fresh entries
      const { error: insertError } = await supabase
        .from('job_feed_items')
        .insert(scoredJobs);
      
      if (insertError) {
        await logRoute(ROUTE, user.id, Date.now() - start, 500)
        console.error('[discover-jobs] Insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Database insert failed', details: String(insertError) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    console.log('[discover-jobs] Fetching final results...');

    // ── Return all non-dismissed items sorted by relevance ───────────────────
    const { data: results, error: fetchError } = await supabase
      .from('job_feed_items')
      .select('id, external_job_id, source, title, company, location, url, employment_type, relevance_score, is_saved, is_dismissed, raw_data, fetched_at')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('relevance_score', { ascending: false })

    if (fetchError) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      console.error('[discover-jobs] Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Database fetch failed', details: String(fetchError) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[discover-jobs] Success! Returning', results?.length ?? 0, 'jobs');
    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return new Response(JSON.stringify({ jobs: results ?? [] }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' },
    })
  } catch (error) {
    console.error('[discover-jobs] FATAL ERROR:', error)
    console.error('[discover-jobs] Error type:', typeof error)
    console.error('[discover-jobs] Error toString:', String(error))
    if (error instanceof Error) {
      console.error('[discover-jobs] Error message:', error.message)
      console.error('[discover-jobs] Error stack:', error.stack)
    }
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
