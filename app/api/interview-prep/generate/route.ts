import { requireAuth } from '@/lib/requireAuth'
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit, LIMITS, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateJSON } from '@/lib/ai'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/interview-prep/generate'

interface InterviewQuestions {
  behavioral_questions: string[]
  technical_questions: string[]
  role_specific_questions: string[]
  tips: string[]
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  if (!body) return err('Invalid request body', 400)

  const jobId: string | undefined = body.jobId
  const manualTitle: string | undefined = body.title
  const manualCompany: string | undefined = body.company
  const manualDescription: string | undefined = body.description

  if (!jobId && !(manualTitle && manualCompany)) {
    return err('Provide either jobId or title and company', 400)
  }

  const limitCheck = await checkLimit(user.id, 'interview')
  if (!limitCheck.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimited('interview practice', LIMITS.interview, 30)
  }

  const rateLimit = await checkRateLimit({
    key: 'interview-prep-generate',
    userId: user.id,
    maxRequests: 10,
    windowMinutes: 60,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining)
  }

  const supabase = await createClient()

  interface JobContext {
    id?: string
    title: string
    company: string
    required_skills?: string[]
    key_responsibilities?: string[]
    company_description?: string
    raw_text?: string
  }

  let jobCtx: JobContext

  if (jobId) {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id, title, company, required_skills, key_responsibilities, company_description')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      await logRoute(ROUTE, user.id, Date.now() - start, 404)
      return notFound('Job')
    }
    jobCtx = job
  } else {
    jobCtx = {
      title: manualTitle!,
      company: manualCompany!,
      raw_text: manualDescription,
    }
  }

  const ctx = await buildUserContext(user.id)
  const contextStr = formatContextForPrompt(ctx)

  const systemPrompt =
    `You are an experienced technical and behavioral interviewer. ` +
    `Generate realistic interview questions a hiring manager at this company would actually ask. ` +
    `Return ONLY valid JSON — no markdown, no backticks, no explanation.`

  const skills = (jobCtx.required_skills ?? []).slice(0, 8).join(', ')
  const responsibilities = (jobCtx.key_responsibilities ?? []).slice(0, 5).join(', ')
  const companyDesc = (jobCtx.company_description ?? jobCtx.raw_text ?? '').slice(0, 300)

  const expSummary = (ctx.experience || []).slice(0, 4).map(e =>
    `${e.title} at ${e.company}: ${(e.bullets || []).slice(0, 2).filter(Boolean).join('; ')}`
  ).join('\n')

  const projSummary = (ctx.projects || []).slice(0, 3).map(p =>
    `${p.name} (${(p.tech_stack || []).join(', ')}): ${(p.bullets || []).slice(0, 1).filter(Boolean).join('')}`
  ).join('\n')

  const userPrompt =
    `${contextStr}\n\n` +
    `Job: ${jobCtx.title} at ${jobCtx.company}.\n` +
    `Required skills: ${skills || 'Not specified'}.\n` +
    `Responsibilities: ${responsibilities || 'Not specified'}.\n` +
    `Company context: ${companyDesc || 'Not provided'}.\n\n` +
    `Candidate's actual work history to ground behavioral questions in:\n${expSummary || 'See resume above'}\n\n` +
    `Candidate's projects:\n${projSummary || 'See resume above'}\n\n` +
    `Return a JSON object with exactly these keys:\n` +
    `{\n` +
    `  "behavioral_questions": [5 STAR-format questions framed as "Tell me about a time when..." that reference THIS candidate's actual experience at their specific companies and projects — not generic situations],\n` +
    `  "technical_questions": [5 questions specific to the required skills listed above, referencing the candidate's tech stack where relevant],\n` +
    `  "role_specific_questions": [3 questions about why this company and this team specifically],\n` +
    `  "tips": [3 specific preparation tips for THIS interview that reference the candidate's experience gaps relative to the role, not generic advice]\n` +
    `}`

  let result: InterviewQuestions
  try {
    result = await withTimeout(
      generateJSON<InterviewQuestions>(systemPrompt, userPrompt),
      60000,
      'interview-generate'
    )
  } catch (e) {
    console.error('[interview-prep/generate] AI error:', e)
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('Failed to generate interview questions'))
  }

  const questionsToSave = jobId
    ? result
    : { ...result, _meta: { title: jobCtx.title, company: jobCtx.company } }

  const { data: savedRow, error: saveError } = await supabase
    .from('interview_sessions')
    .insert({ user_id: user.id, job_id: jobId ?? null, questions: questionsToSave })
    .select('id, user_id, job_id, questions, practice_answers, feedback, created_at')
    .single()

  if (saveError || !savedRow) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error(saveError?.message ?? 'Failed to save interview session'))
  }

  void Promise.resolve(
    supabase.from('events').insert({ user_id: user.id, event_name: 'interview_session_started', properties: { job_title: jobCtx.title } })
  ).catch(() => {})

  await logRoute(ROUTE, user.id, Date.now() - start, 200)
  return ok({ session: savedRow })
}
