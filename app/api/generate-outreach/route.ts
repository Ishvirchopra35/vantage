// Networking message generator (connection request / cold email / follow-up)
// with refine mode: rewrite a saved message per a user instruction.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit, consumeLimit, checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateText, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai'
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
    // Plain-text job context for manually tracked applications (no jobs row)
    jobTitle?: string
    jobCompany?: string
    // Refine mode: rewrite the saved message per the user's instruction
    // instead of generating from scratch. Counts against the same limits.
    refineMessageId?: string
    refineInstruction?: string
  }>(body, ['contactName', 'contactTitle', 'contactCompany', 'messageType'])
  if (!validation.valid) return err(validation.error, 400)
  const {
    contactName, contactTitle, contactCompany, messageType,
    contactLinkedinUrl, jobId, jobTitle, jobCompany,
    refineMessageId, refineInstruction,
  } = validation.data

  const validTypes: MessageType[] = ['connection_request', 'cold_email', 'follow_up']
  if (!validTypes.includes(messageType)) return err('Invalid messageType', 400)

  const isRefine = Boolean(refineMessageId || refineInstruction)
  if (isRefine) {
    if (!refineMessageId || !refineInstruction?.trim()) {
      return err('Refining needs both the message and an instruction', 400)
    }
    if (refineInstruction.trim().length > 300) {
      return err('Keep the instruction under 300 characters', 400)
    }
  }

  const limitCheck = await checkLimit(user.id, 'networking')
  if (!limitCheck.allowed) return rateLimited('networking message', 15, 30)

  const rateLimit = await checkRateLimit({
    key: 'networking-outreach',
    userId: user.id,
    devLimit: 2,
    freeLimit: 15,
    proLimit: 7,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
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
    : jobTitle && jobCompany
      ? `\nJob context: Applying for ${jobTitle} at ${jobCompany}.`
      : ''

  const contactContext = `Contact: ${contactName}, ${contactTitle} at ${contactCompany}.`

  // Pull the concrete material the message should be built from: who they
  // are (school/program), what they are doing right now (most recent role
  // with its actual bullets), and one flagship project.
  const mostRecentExp = (ctx.experience || [])[0]
  const jobSkills = job ? ((job.required_skills ?? []) as string[]) : []
  const relevantProject = (ctx.projects || []).find(p =>
    jobSkills.some(s =>
      (p.tech_stack || []).some(t => s.toLowerCase().includes(t.toLowerCase()))
    )
  ) ?? (ctx.projects || [])[0]

  const identityLine = ctx.university
    ? `The sender is a student at ${ctx.university}${ctx.graduationYear ? ` (graduating ${ctx.graduationYear})` : ''}.`
    : ''
  const currentWorkLine = mostRecentExp
    ? `Their current/most recent role: ${mostRecentExp.title} at ${mostRecentExp.company}. ` +
      `Raw resume notes on that work (synthesize into flowing prose, never quote as-is): ` +
      `${(mostRecentExp.bullets || []).slice(0, 3).join('; ') || 'no details listed'}.`
    : ''
  const projectLine = relevantProject
    ? `Flagship project: ${relevantProject.name}${(relevantProject.tech_stack || []).length ? ` (${(relevantProject.tech_stack || []).join(', ')})` : ''}` +
      `${relevantProject.description ? ` - ${relevantProject.description}` : ''}.`
    : ''
  const senderMaterial = [identityLine, currentWorkLine, projectLine].filter(Boolean).join('\n')

  const messageInstructions: Record<MessageType, string> = {
    connection_request:
      `Write a LinkedIn connection request to ${contactName}. This is a first hello, NOT a pitch:\n` +
      `- Shape: greeting + identity, then ONE conversational sentence about what the sender is working on ` +
      `or moving toward (plain language - what it is and who it's for, no metrics, no percentages, no ` +
      `resume phrasing), then a simple ask to connect.\n` +
      `- CONNECTION EXAMPLE (imitate the tone, not the facts): "Hi {name}, {university} {program} student ` +
      `here. I'm spending my co-op building {plain-language description of current work}, and I'd like to ` +
      `follow the work your team is doing at {company}. Would be glad to connect."\n` +
      `- Do NOT ask for a job, internship, referral, or interview - the only ask is connecting.\n` +
      `- Hard limit 280 characters; aim for 250.`,
    cold_email:
      `Write a cold outreach email to ${contactName}, following the PITCH EXAMPLE's structure and rhythm ` +
      `(with room for one more sentence of work detail). ` +
      `First line must be: SUBJECT: [subject line here] (make the subject specific and compelling). ` +
      `Then the email body. MAX 150 words total including the subject line.`,
    follow_up:
      `Write a brief follow-up message to ${contactName}, referencing a previous message the sender sent. ` +
      `Move the conversation forward with one specific ask or one concrete update on the sender's work, ` +
      `conversational and warm. MAX 80 words.`,
  }

  const systemPrompt =
    `You write networking messages in the sender's own first-person voice.\n\n` +
    `PITCH EXAMPLE - the structure for cold emails (the facts will be different):\n` +
    `"Hi {name}, {university} {program} student here. I know {company} may not have an open {role type} ` +
    `role right now, but I wanted to ask if your team would consider bringing me on. I'm a {current role} ` +
    `at {organization}, {one flowing clause about what they're building and who it's for}, and I'm ` +
    `building {side project} on the side, {one clause about what it does}."\n\n` +
    `Rules:\n` +
    `1. Write flowing, connected sentences. NEVER stitch resume bullets together ` +
    `("I refactored X, reducing errors by 15%. I'm also building Y.") - that reads as a bot. ` +
    `Numbers and percentages belong in resumes, not in these messages.\n` +
    `2. Describe work by what it does and who it's for, in words a stranger would enjoy reading: ` +
    `"rebuilding a health app's interface so older adults can actually use it" is good; ` +
    `"debugged data errors to boost report accuracy from 82% to 95%" is not.\n` +
    `3. One ask per message, matched to the type: connection requests only ask to connect; ` +
    `cold emails may ask to be considered for a role, a referral, or a short chat. ` +
    `Never "would love to connect and learn more" - that exact filler is banned.\n` +
    `4. Identity comes from the sender material (university, program, current role). If a detail is ` +
    `missing, leave it out - never invent schools, roles, or projects.\n` +
    `5. Never use: "I hope this message finds you well", "reaching out", "I came across your profile", ` +
    `"I'm passionate about", "I'm impressed by", "innovative approach", "fellow developer", or any company flattery.\n` +
    `6. Length limits are hard: connection_request 280 characters, cold_email 150 words, follow_up 80 words.\n` +
    `Return ONLY the message text - no explanation, no preamble, no meta-commentary.`

  // Refine mode: rewrite the saved message per the user's instruction. The
  // base text is whatever the user currently sees (their edit if they made
  // one, otherwise the generated text).
  let refineBlock = ''
  if (isRefine) {
    const { data: existing } = await supabase
      .from('outreach_messages')
      .select('id, generated_message, user_edited_message')
      .eq('id', refineMessageId as string)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      await logRoute(ROUTE, user.id, Date.now() - start, 404)
      return err('Message not found', 404)
    }

    const currentMessage = existing.user_edited_message ?? existing.generated_message ?? ''
    refineBlock =
      `\n\nCURRENT MESSAGE:\n"""${currentMessage}"""\n\n` +
      `SENDER'S REVISION REQUEST: "${refineInstruction!.trim()}"\n\n` +
      `Rewrite the current message applying the revision request. Keep everything the sender did not ` +
      `ask to change, keep all rules above, and stay within the length limit. Return ONLY the revised message.`
  }

  const userPrompt =
    `${formatContextForPrompt(ctx)}` +
    `${jobContext}\n\n` +
    `SENDER MATERIAL (build the message from these specifics):\n${senderMaterial || 'Use the resume context above.'}\n\n` +
    `${contactContext}\n\n` +
    `${messageInstructions[messageType]}` +
    refineBlock

  let generatedMessage: string
  try {
    generatedMessage = await withTimeout(
      generateText(systemPrompt, userPrompt, 400),
      30000,
      'generate-outreach'
    )
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return err(AI_BUSY_MESSAGE, 429)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('Failed to generate message'))
  }

  const rowColumns =
    'id, user_id, contact_name, contact_title, contact_company, contact_linkedin_url, message_type, generated_message, user_edited_message, sent, sent_at, job_id, created_at'

  let savedRow: Record<string, unknown> | null = null
  let saveError: { message: string } | null = null

  if (isRefine) {
    // Replace the generated text in place; the user's manual edit is cleared
    // because the revision supersedes it (it was the base of the rewrite).
    const result = await supabase
      .from('outreach_messages')
      .update({ generated_message: generatedMessage, user_edited_message: null })
      .eq('id', refineMessageId as string)
      .eq('user_id', user.id)
      .select(rowColumns)
      .single()
    savedRow = result.data
    saveError = result.error
  } else {
    const result = await supabase
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
      .select(rowColumns)
      .single()
    savedRow = result.data
    saveError = result.error
  }

  if (saveError || !savedRow) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error(saveError?.message ?? 'Failed to save message'))
  }

  void Promise.resolve(
    supabase.from('events').insert({
      user_id: user.id,
      event_name: isRefine ? 'networking_message_refined' : 'networking_message_generated',
      properties: { message_type: messageType, contact_company: contactCompany },
    })
  ).catch(() => {})

  // Charge the limits only now that the message was generated and saved.
  await Promise.all([
    consumeLimit(user.id, 'networking'),
    recordRateLimitUse('networking-outreach', user.id),
    logRoute(ROUTE, user.id, Date.now() - start, 200),
  ])
  return ok({ message: savedRow })
}
