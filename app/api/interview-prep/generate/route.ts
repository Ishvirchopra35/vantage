import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit, LIMITS } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateJSONCerebras, generateJSONSecondary } from '@/lib/ai'
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
  const validation = validateBody<{ jobId: string }>(body, ['jobId'])
  if (!validation.valid) return err(validation.error, 400)
  const { jobId } = validation.data

  const limitCheck = await checkLimit(user.id, 'interview')
  if (!limitCheck.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimited('interview practice', LIMITS.interview, 30)
  }

  const supabase = await createClient()

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

  const ctx = await buildUserContext(user.id)
  const contextStr = formatContextForPrompt(ctx)

  const systemPrompt =
    `You are an experienced technical and behavioral interviewer. ` +
    `Generate realistic interview questions a hiring manager at this company would actually ask. ` +
    `Return ONLY valid JSON — no markdown, no backticks, no explanation.`

  const skills = (job.required_skills ?? []).slice(0, 8).join(', ')
  const responsibilities = (job.key_responsibilities ?? []).slice(0, 5).join(', ')
  const companyDesc = (job.company_description ?? '').slice(0, 300)

  const userPrompt =
    `${contextStr}\n\n` +
    `Job: ${job.title} at ${job.company}.\n` +
    `Required skills: ${skills || 'Not specified'}.\n` +
    `Responsibilities: ${responsibilities || 'Not specified'}.\n` +
    `Company: ${companyDesc || 'Not provided'}.\n\n` +
    `Return a JSON object with exactly these keys:\n` +
    `{\n` +
    `  "behavioral_questions": [5 STAR-format questions tailored to THIS role's responsibilities],\n` +
    `  "technical_questions": [5 questions specific to the required skills listed above],\n` +
    `  "role_specific_questions": [3 questions about why this company and this team specifically],\n` +
    `  "tips": [3 specific preparation tips for THIS interview, not generic advice]\n` +
    `}`

  console.error('[interview-prep/generate] Cerebras key present:', !!process.env.CEREBRAS_API_KEY)

  let result: InterviewQuestions
  try {
    if (process.env.CEREBRAS_API_KEY) {
      result = await withTimeout(
        generateJSONCerebras<InterviewQuestions>(systemPrompt, userPrompt),
        30000,
        'interview-generate'
      )
    } else {
      console.error('[interview-prep/generate] No Cerebras key — falling back to Groq secondary')
      result = await withTimeout(
        generateJSONSecondary<InterviewQuestions>(systemPrompt, userPrompt),
        45000,
        'interview-generate-groq'
      )
    }
  } catch (e) {
    console.error('[interview-prep/generate] AI error:', e)
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('Failed to generate interview questions'))
  }

  const { data: savedRow, error: saveError } = await supabase
    .from('interview_sessions')
    .insert({ user_id: user.id, job_id: jobId, questions: result })
    .select('id, user_id, job_id, questions, practice_answers, feedback, created_at')
    .single()

  if (saveError || !savedRow) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error(saveError?.message ?? 'Failed to save interview session'))
  }

  void Promise.resolve(
    supabase.from('events').insert({ user_id: user.id, event_name: 'interview_session_started', properties: { job_title: job.title } })
  ).catch(() => {})

  await logRoute(ROUTE, user.id, Date.now() - start, 200)
  return ok({ session: savedRow })
}
