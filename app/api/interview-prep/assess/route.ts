// Scores one practice interview answer: rating, strengths, improvements,
// filler-word count. Stored on the interview_sessions row.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, notFound, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { withTimeout } from '@/lib/withTimeout'
import { generateJSON, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai'
import { checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/interview-prep/assess'

interface Assessment {
  score: number
  content_score: number
  delivery_score: number
  strengths: string[]
  improvements: string[]
  filler_words_detected: string[]
  better_answer_hint: string
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const rateLimit = await checkRateLimit({
    key: 'interview-prep-assess',
    userId: user.id,
    devLimit: 5,
    freeLimit: 15,
    proLimit: 10,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  const body = await request.json().catch(() => null)
  const validation = validateBody<{
    sessionId: string
    question: string
    answer: string
    transcript?: string
    questionType?: string
  }>(body, ['sessionId', 'question', 'answer'])
  if (!validation.valid) return err(validation.error, 400)

  const { sessionId, question, answer, transcript } = validation.data

  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('interview_sessions')
    .select('id, user_id, job_id, questions, practice_answers, feedback')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) return notFound('Session')

  let jobTitle = 'N/A'
  if (session.job_id) {
    const { data: j } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('id', session.job_id)
      .single()
    if (j?.title) jobTitle = j.title
  }

  const ctx = await buildUserContext(user.id)
  const contextStr = formatContextForPrompt(ctx)

  const systemPrompt =
    `You are an expert interview coach assessing a candidate's answer. ` +
    `Return ONLY valid JSON - no markdown, no backticks, no explanation.`

  const userPrompt =
    `${contextStr}\n\n` +
    `Job: ${jobTitle}\n` +
    `Question: ${question}\n` +
    `Candidate's answer: ${answer}\n` +
    (transcript ? `Transcript (voice): ${transcript}\n` : '') +
    `\nReturn a JSON object with exactly these keys:\n` +
    `{\n` +
    `  "score": integer 0-10 (overall),\n` +
    `  "content_score": integer 0-10 (relevance, specificity, real examples),\n` +
    `  "delivery_score": integer 0-10 (conciseness, clarity, filler words),\n` +
    `  "strengths": [2-3 specific things done well],\n` +
    `  "improvements": [2-3 specific things to improve],\n` +
    `  "filler_words_detected": [list of filler words used: um, uh, like, you know],\n` +
    `  "better_answer_hint": "one sentence under 30 words"\n` +
    `}`

  let assessment: Assessment
  try {
    assessment = await withTimeout(
      generateJSON<Assessment>(systemPrompt, userPrompt),
      30000,
      'interview-assess'
    )
  } catch (e) {
    console.error('[interview-prep/assess] AI error:', e)
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return err(AI_BUSY_MESSAGE, 429)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('Failed to assess answer'))
  }

  const existingFeedback = (session.feedback ?? {}) as Record<string, Assessment>
  const newFeedback = { ...existingFeedback, [question]: assessment }

  const { error: updateError } = await supabase
    .from('interview_sessions')
    .update({ feedback: newFeedback })
    .eq('id', sessionId)

  if (updateError) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('Failed to save assessment'))
  }

  // Charge the limit only now that the assessment was generated and saved.
  await Promise.all([
    recordRateLimitUse('interview-prep-assess', user.id),
    logRoute(ROUTE, user.id, Date.now() - start, 200),
  ])
  return ok({ assessment })
}
