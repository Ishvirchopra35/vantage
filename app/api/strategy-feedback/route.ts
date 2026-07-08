import { requireAuth } from '@/lib/requireAuth'
import { ok, err, rateLimited, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateJSON } from '@/lib/ai'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { createClient } from '@/lib/supabase/server'
import { hasRealJobTitle } from '@/lib/jobFilters'

export interface StrategyFeedback {
  top_insights: string[]
  focus_roles: string[]
  avoid_roles: string[]
  ats_insight: string
  top_suggestions: string[]
  skill_gaps_to_fix: string[]
}

type AppRow = { role: string | null; status: string; job_id: string | null }
type AtsRow = { overall_score: number | null; job_id: string | null; missing_keywords: string[] | null }

function avg(arr: number[]): number | null {
  return arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
}

export async function GET(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'

  const supabase = await createClient()

  const [appCountResult, cachedResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('strategy_feedback')
      .select('feedback, generated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const total = appCountResult.count ?? 0

  if (total < 15) {
    await logRoute('/api/strategy-feedback', user.id, Date.now() - start, 400)
    return err('Not enough data - apply to at least 15 jobs first', 400)
  }

  // Return cache if fewer than 5 new applications since last generation
  const cached = cachedResult.data
  if (!force && cached?.generated_at) {
    const { count: newCount } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gt('created_at', cached.generated_at)

    if ((newCount ?? 0) < 5) {
      await logRoute('/api/strategy-feedback', user.id, Date.now() - start, 200)
      return ok({ feedback: cached.feedback, cached: true, generatedAt: cached.generated_at })
    }
  }

  // Rate limit only applies when actually generating
  const limit = await checkLimit(user.id, 'strategy_feedback')
  if (!limit.allowed) {
    await logRoute('/api/strategy-feedback', user.id, Date.now() - start, 429)
    return rateLimited('strategy feedback', 2, 30)
  }

  // Fetch analytics data
  const [appDataResult, atsDataResult] = await Promise.all([
    supabase
      .from('applications')
      .select('role, status, job_id')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('ats_scores')
      .select('overall_score, job_id, missing_keywords')
      .eq('user_id', user.id),
  ])

  const apps = (appDataResult.data ?? []) as AppRow[]
  const atsScores = (atsDataResult.data ?? []) as AtsRow[]

  // Status breakdown and response rate
  const breakdown = {
    applied: apps.filter(a => a.status === 'applied').length,
    interviewing: apps.filter(a => a.status === 'interviewing').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    offer: apps.filter(a => a.status === 'offer').length,
    ghosted: apps.filter(a => a.status === 'ghosted').length,
  }
  const responseCount = breakdown.interviewing + breakdown.offer
  const responseRate = total > 0 ? Math.round((responseCount / total) * 1000) / 10 : 0

  // Response rate grouped by role. Defensive guard: only group rows whose role
  // is a real job title so a null/empty/whitespace/"Untitled" role can't surface
  // in the strategy output grouping (Requirement 4.4).
  const roleMap: Record<string, { total: number; successes: number }> = {}
  for (const app of apps) {
    if (!hasRealJobTitle(app.role)) continue
    const role = app.role as string
    if (!roleMap[role]) roleMap[role] = { total: 0, successes: 0 }
    roleMap[role].total++
    if (app.status === 'interviewing' || app.status === 'offer') roleMap[role].successes++
  }
  const responseRateByRole = Object.entries(roleMap)
    .map(([role, { total: t, successes }]) => ({
      role,
      rate: Math.round((successes / t) * 100),
      total: t,
    }))
    .sort((a, b) => b.rate - a.rate)

  // ATS score comparison: interviews+offers vs rejections
  const jobStatusMap: Record<string, string> = {}
  for (const app of apps) {
    if (app.job_id) jobStatusMap[app.job_id] = app.status
  }
  const successScores: number[] = []
  const rejectedScores: number[] = []
  const allScoreValues: number[] = []
  for (const s of atsScores) {
    if (s.overall_score == null) continue
    allScoreValues.push(s.overall_score)
    if (!s.job_id) continue
    const st = jobStatusMap[s.job_id]
    if (st === 'interviewing' || st === 'offer') successScores.push(s.overall_score)
    else if (st === 'rejected') rejectedScores.push(s.overall_score)
  }

  const avgAtsSuccess = avg(successScores)
  const avgAtsRejected = avg(rejectedScores)
  const avgAtsOverall = avg(allScoreValues)

  // Top 5 missing keywords across all ATS scores
  const kwMap: Record<string, number> = {}
  for (const s of atsScores) {
    for (const kw of s.missing_keywords ?? []) {
      kwMap[kw] = (kwMap[kw] || 0) + 1
    }
  }
  const topMissingKeywords = Object.entries(kwMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([kw]) => kw)

  const ctx = await buildUserContext(user.id)
  const contextStr = formatContextForPrompt(ctx)

  const roleRateStr = responseRateByRole
    .slice(0, 8)
    .map(r => `${r.role}: ${r.rate}% (${r.total} apps)`)
    .join(', ')

  const systemPrompt =
    'You are a job search strategy analyst. Generate data-driven, specific advice. Return ONLY valid JSON.'

  const userPrompt = `${contextStr}

ANALYTICS:
Total applications: ${total}
Response rate: ${responseRate}%
Response rate by role: ${roleRateStr || 'N/A'}
Status breakdown: ${JSON.stringify(breakdown)}
ATS score for interviews/offers: ${avgAtsSuccess != null ? `${avgAtsSuccess}/100` : 'N/A'} vs ATS score for rejections: ${avgAtsRejected != null ? `${avgAtsRejected}/100` : 'N/A'}
Average ATS score overall: ${avgAtsOverall != null ? `${avgAtsOverall}/100` : 'N/A'}
Most common missing ATS keywords: ${topMissingKeywords.join(', ') || 'none tracked'}

Return JSON with exactly these keys:
{
  "top_insights": ["3 specific observations grounded in the actual numbers - not generic advice"],
  "focus_roles": ["roles with highest response rate - name them specifically"],
  "avoid_roles": ["role name - specific reason this role has poor response rate for this candidate"],
  "ats_insight": "1 sentence: does a higher ATS score correlate with getting interviews for this specific user?",
  "top_suggestions": ["actionable step under 25 words", "actionable step", "actionable step", "actionable step"],
  "skill_gaps_to_fix": ["keyword that appears most in missing_keywords and would improve ATS score"]
}`

  let feedback: StrategyFeedback
  try {
    feedback = await withTimeout(
      generateJSON<StrategyFeedback>(systemPrompt, userPrompt),
      30000,
      'strategy-feedback'
    )
  } catch (e) {
    await logRoute('/api/strategy-feedback', user.id, Date.now() - start, 500)
    return serverError(e)
  }

  const generatedAt = new Date().toISOString()

  await supabase
    .from('strategy_feedback')
    .upsert(
      { user_id: user.id, feedback, generated_at: generatedAt },
      { onConflict: 'user_id' }
    )

  void Promise.resolve(
    supabase
      .from('events')
      .insert({ user_id: user.id, event_name: 'viewed_strategy_feedback', properties: {} })
  ).catch(() => {})

  await logRoute('/api/strategy-feedback', user.id, Date.now() - start, 200)
  return ok({ feedback, cached: false, generatedAt })
}
