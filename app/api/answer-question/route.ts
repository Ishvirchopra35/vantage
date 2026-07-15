// Generates an answer to one application question using the user's full
// context; saved to application_questions. GET lists saved answers.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit, consumeLimit, LIMITS, checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateText, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/answer-question'

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  const validation = validateBody<{ applicationId: string; question: string; jobId?: string | null }>(
    body,
    ['applicationId', 'question']
  )
  if (!validation.valid) return err(validation.error, 400)
  const { applicationId, question, jobId } = validation.data

  const limitCheck = await checkLimit(user.id, 'tailoring')
  if (!limitCheck.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimited('question answering', LIMITS.tailoring, 30)
  }

  const rateLimit = await checkRateLimit({
    key: 'answer-question',
    userId: user.id,
    devLimit: 5,
    freeLimit: 15,
    proLimit: 10,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  const supabase = await createClient()

  // The application is the source of truth (manual applications have no jobs
  // row at all). The jobs lookup below is an optional enrichment.
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, company, role, job_id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .single()

  if (appError || !application) {
    await logRoute(ROUTE, user.id, Date.now() - start, 404)
    return notFound('Application')
  }

  const effectiveJobId = application.job_id ?? jobId ?? null

  let job: { id: string; title: string; company: string; required_skills: string[] | null; keywords: string[] | null } | null = null
  if (effectiveJobId) {
    const { data: jobRow } = await supabase
      .from('jobs')
      .select('id, title, company, required_skills, keywords')
      .eq('id', effectiveJobId)
      .eq('user_id', user.id)
      .maybeSingle()
    job = jobRow ?? null
  }

  const jobTitle = job?.title ?? application.role
  const jobCompany = job?.company ?? application.company

  const ctx = await buildUserContext(user.id)

  const systemPrompt = `You are an expert job application assistant helping candidates answer application form questions authentically.

Rules:
1. Every answer must be grounded in the candidate's actual resume and experience. Never fabricate, invent, or exaggerate anything.
2. Answers must sound natural and human - not like a template or AI output. Use the candidate's apparent writing voice from their resume.
3. Be specific: reference actual project names, technologies, role titles, or achievements from the resume when relevant.
4. Answer the exact question asked - do not go on tangents.
5. Length: answer the question completely but concisely. Under 150 words unless the question explicitly asks for more detail (e.g. 'describe in detail').
6. Return ONLY the answer text - no preamble, no explanation, no 'Here is your answer:'.`

  const userPrompt = `Answer this job application question for this candidate.

APPLICATION QUESTION: ${question}

${formatContextForPrompt(ctx)}

JOB: ${jobTitle} at ${jobCompany}${
    job && (job.required_skills ?? []).length > 0
      ? `\nKey requirements: ${(job.required_skills ?? []).slice(0, 6).join(', ')}`
      : ''
  }${
    job && (job.keywords ?? []).length > 0
      ? `\nATS keywords relevant to this question: ${(job.keywords ?? []).slice(0, 15).join(', ')}`
      : ''
  }

Instructions: Draw from their specific resume content. Reference real work, projects, and technologies they've actually listed.`

  let generatedAnswer: string
  try {
    generatedAnswer = await withTimeout(
      generateText(systemPrompt, userPrompt, 400),
      30000,
      'answer-question'
    )
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return err(AI_BUSY_MESSAGE, 429)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('Failed to generate answer'))
  }

  const { data: savedRow, error: saveError } = await supabase
    .from('application_questions')
    .insert({
      user_id: user.id,
      job_id: job?.id ?? null,
      application_id: applicationId,
      question,
      generated_answer: generatedAnswer,
    })
    .select('id, user_id, job_id, application_id, question, generated_answer, user_edited_answer, is_used, created_at')
    .single()

  if (saveError || !savedRow) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error(saveError?.message || 'Failed to save answer'))
  }

  void Promise.resolve(
    supabase.from('events').insert({
      user_id: user.id,
      event_name: 'application_question_answered',
      properties: { job_title: jobTitle },
    })
  ).catch(() => {})

  // Charge the limits only now that the answer was generated and saved.
  await Promise.all([
    consumeLimit(user.id, 'tailoring'),
    recordRateLimitUse('answer-question', user.id),
    logRoute(ROUTE, user.id, Date.now() - start, 200),
  ])
  return ok({ question: savedRow })
}

export async function GET(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const { searchParams } = new URL(request.url)
  const applicationId = searchParams.get('applicationId')

  if (!applicationId) {
    return err('applicationId query parameter is required', 400)
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('application_questions')
      .select('id, user_id, job_id, application_id, question, generated_answer, user_edited_answer, is_used, created_at')
      .eq('application_id', applicationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return serverError(error)
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ questions: data ?? [] })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
