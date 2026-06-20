import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateText } from '@/lib/ai'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/generate-outreach'

type MessageType = 'connection_request' | 'cold_email' | 'follow_up'

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  const validation = validateBody<{
    contactName: string
    contactTitle: string
    contactCompany: string
    messageType: MessageType
    contactLinkedinUrl?: string
    jobId?: string
  }>(body, ['contactName', 'contactTitle', 'contactCompany', 'messageType'])
  if (!validation.valid) return err(validation.error, 400)
  const { contactName, contactTitle, contactCompany, messageType, contactLinkedinUrl, jobId } = validation.data

  const validTypes: MessageType[] = ['connection_request', 'cold_email', 'follow_up']
  if (!validTypes.includes(messageType)) return err('Invalid messageType', 400)

  const limitCheck = await checkLimit(user.id, 'networking')
  if (!limitCheck.allowed) return rateLimited('networking message', 15, 30)

  const rateLimit = await checkRateLimit({
    key: 'networking-outreach',
    userId: user.id,
    maxRequests: 10,
    windowMinutes: 60,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining)
  }

  const supabase = await createClient()

  const [ctxResult, jobResult] = await Promise.all([
    buildUserContext(user.id),
    jobId
      ? supabase
          .from('jobs')
          .select('id, title, company, required_skills, key_responsibilities, company_description')
          .eq('id', jobId)
          .eq('user_id', user.id)
          .single()
      : Promise.resolve(null),
  ])

  const ctx = ctxResult
  const job = jobResult && 'data' in jobResult ? jobResult.data : null

  const jobContext = job
    ? `\nJob context: Applying for ${job.title} at ${job.company}. ` +
      `Key requirements: ${(job.required_skills ?? []).slice(0, 5).join(', ')}. ` +
      `${(job.company_description ?? '').slice(0, 150)}`
    : ''

  const contactContext = `Contact: ${contactName}, ${contactTitle} at ${contactCompany}.`

  // Find most relevant experience and project to reference in the message
  const mostRecentExp = (ctx.experience || [])[0]
  const jobSkills = job ? ((job.required_skills ?? []) as string[]) : []
  const relevantProject = (ctx.projects || []).find(p =>
    jobSkills.some(s =>
      (p.tech_stack || []).some(t => s.toLowerCase().includes(t.toLowerCase()))
    )
  ) ?? (ctx.projects || [])[0]

  const candidateHighlight = mostRecentExp
    ? `The candidate's most recent role is ${mostRecentExp.title} at ${mostRecentExp.company}.`
    : ''
  const projectHighlight = relevantProject
    ? `They have a notable project: ${relevantProject.name} using ${(relevantProject.tech_stack || []).join(', ')}.`
    : ''

  const messageInstructions: Record<MessageType, string> = {
    connection_request:
      `Write a LinkedIn connection request to ${contactName}. ` +
      `MAX 280 CHARACTERS — this is a hard limit enforced by LinkedIn. ` +
      `Genuine, specific reason for connecting. Reference their role or company specifically. ` +
      `${candidateHighlight} ${projectHighlight} Weave in one specific detail from the candidate's background if it fits naturally.`,
    cold_email:
      `Write a cold outreach email to ${contactName}. ` +
      `First line must be: SUBJECT: [subject line here] (make the subject specific and compelling). ` +
      `Then the email body. MAX 150 words total including the subject line. ` +
      `${candidateHighlight} ${projectHighlight} Reference a specific accomplishment or project from the candidate's background to establish credibility.`,
    follow_up:
      `Write a brief follow-up message to ${contactName}, referencing a previous message you sent. ` +
      `Move the conversation forward with a specific ask or update. MAX 80 words. ` +
      `${candidateHighlight} If relevant, mention a recent project or update from the candidate's work.`,
  }

  const systemPrompt =
    `You are an expert at professional networking messages. Rules: ` +
    `(1) Sound like a specific human, not a template. ` +
    `(2) Never use: "I hope this message finds you well", "reaching out", "I came across your profile", ` +
    `"I'm passionate about", or any opener cliché. ` +
    `(3) Reference something specific about the contact's role or the company. ` +
    `(4) connection_request: max 280 characters (LinkedIn limit). cold_email: max 150 words. follow_up: max 80 words. ` +
    `Return ONLY the message text — no subject line label explanation, no preamble, no meta-commentary.`

  const userPrompt =
    `${formatContextForPrompt(ctx)}` +
    `${jobContext}\n\n` +
    `${contactContext}\n\n` +
    `${messageInstructions[messageType]}`

  let generatedMessage: string
  try {
    generatedMessage = await withTimeout(
      generateText(systemPrompt, userPrompt, 400),
      30000,
      'generate-outreach'
    )
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('Failed to generate message'))
  }

  const { data: savedRow, error: saveError } = await supabase
    .from('outreach_messages')
    .insert({
      user_id: user.id,
      contact_name: contactName,
      contact_title: contactTitle,
      contact_company: contactCompany,
      contact_linkedin_url: contactLinkedinUrl ?? null,
      message_type: messageType,
      generated_message: generatedMessage,
      job_id: jobId ?? null,
    })
    .select('id, user_id, contact_name, contact_title, contact_company, contact_linkedin_url, message_type, generated_message, user_edited_message, sent, sent_at, job_id, created_at')
    .single()

  if (saveError || !savedRow) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error(saveError?.message ?? 'Failed to save message'))
  }

  void Promise.resolve(
    supabase.from('events').insert({
      user_id: user.id,
      event_name: 'networking_message_generated',
      properties: { message_type: messageType, contact_company: contactCompany },
    })
  ).catch(() => {})

  await logRoute(ROUTE, user.id, Date.now() - start, 200)
  return ok({ message: savedRow })
}
