import { createClient } from '@supabase/supabase-js'
import { ok, unauthorized, serverError } from '@/lib/apiResponse'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { generateJSON } from '@/lib/ai'
import { withTimeout } from '@/lib/withTimeout'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Question {
  label: string
  kind?: string
  options?: string[]
}

interface FieldAnswer {
  label: string
  answer: string | null
}

// ── Deterministic guards ───────────────────────────────────────────────────────
// The extension shouldn't send these, but the server enforces it anyway:
// factual profile fields and demographics never go through the AI.

const TIER1_LABEL_RE =
  /first\s*name|last\s*name|full\s*name|given\s*name|family\s*name|surname|e-?mail|\bphone\b|\bmobile\b|telephone|linked\s*in|git\s*hub|portfolio|\bwebsite\b|\bcity\b|current\s*location|\baddress\b|postal|zip\s*code/i

const DEMOGRAPHIC_RE =
  /gender|ethnic|race\b|hispanic|latino|veteran|disab|sexual\s*orientation|transgender|pronoun|lgbtq|demographic/i

const HEAR_ABOUT_RE =
  /how\s*did\s*you\s*hear|how\s*did\s*you\s*(find|learn)\s*(out\s*)?about|hear\s*about\s*(us|this)|referral\s*source/i

const DECLINE_RE = /don'?t\s+wish|prefer\s+not|decline\s+to|rather\s+not/i

function findOption(options: string[] | undefined, pattern: RegExp): string | null {
  if (!options?.length) return null
  return options.find(o => pattern.test(o)) ?? null
}

// Resolves a question without AI, or returns undefined if it needs the model.
function deterministicAnswer(q: Question): string | null | undefined {
  if (HEAR_ABOUT_RE.test(q.label)) {
    // Rule: always "Job Board" or blank — never an invented referral source
    return findOption(q.options, /job\s*board/i) ?? (q.options?.length ? null : 'Job Board')
  }
  if (DEMOGRAPHIC_RE.test(q.label)) {
    // Demographics stay blank unless an explicit decline option exists
    return findOption(q.options, DECLINE_RE)
  }
  if (TIER1_LABEL_RE.test(q.label)) {
    // Factual profile fields are Tier 1 — the extension fills them directly
    return null
  }
  return undefined
}

// Snap an AI dropdown answer to exact option text, or null it out.
function validateOptionAnswer(answer: string | null, options: string[]): string | null {
  if (!answer) return null
  const target = answer.toLowerCase().trim()
  const exact = options.find(o => o.toLowerCase().trim() === target)
  if (exact) return exact
  const contains = options.find(
    o => o.toLowerCase().includes(target) || target.includes(o.toLowerCase().trim())
  )
  return contains ?? null
}

function sanitizeAnswer(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s || s.toLowerCase() === 'null' || s.toUpperCase() === 'SKIP') return null
  return s
}

function formatQuestions(questions: Question[]): string {
  return questions
    .map(q => {
      if (q.options?.length) {
        return `Q: "${q.label}"\n  Options: ${q.options.join(' | ')}\n  → Copy exactly one option verbatim, or null if the profile doesn't determine the answer`
      }
      return `Q: "${q.label}"\n  → Answer from the profile, or null if the profile doesn't contain the information`
    })
    .join('\n\n')
}

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return unauthorized()

  const token = authHeader.slice(7).trim()
  if (!token) return unauthorized()

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('extension_token', token)
    .limit(1)
    .single()

  if (profileError || !profile) return unauthorized()

  const resolvedUserId = profile.id as string

  const rateLimit = await checkRateLimit({
    key: 'extension-ai-fill',
    userId: resolvedUserId,
    maxRequests: 20,
    windowMinutes: 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining)
  }

  let body: { questions: Question[]; jobUrl?: string }
  try {
    body = await request.json()
  } catch {
    return serverError(new Error('Invalid request body'))
  }

  const questions = Array.isArray(body.questions) ? body.questions.slice(0, 50) : []
  if (!questions.length) return ok({ fields: [] })

  // Split deterministic answers from questions that genuinely need the AI
  const resolved: FieldAnswer[] = []
  const aiQuestions: Question[] = []
  for (const q of questions) {
    if (typeof q?.label !== 'string' || !q.label.trim()) continue
    const det = deterministicAnswer(q)
    if (det !== undefined) {
      resolved.push({ label: q.label, answer: det })
    } else {
      aiQuestions.push(q)
    }
  }

  if (!aiQuestions.length) {
    return ok({ fields: resolved.filter(f => f.answer !== null) })
  }

  try {
    const ctx = await buildUserContext(resolvedUserId)
    const contextStr = formatContextForPrompt(ctx)
    const resumeText = ctx.baseResume ?? 'No resume uploaded'

    const systemPrompt = `You help a job applicant answer open-ended application questions using ONLY the facts in their profile and resume.

ABSOLUTE RULES — violating any of these makes the output worthless:
1. NEVER invent facts. No made-up companies, organizations, websites, dates, numbers, referral sources, or personal details. If the profile does not contain the information a question asks for, the answer is null.
2. For questions with an Options list, the answer must be one option copied VERBATIM, character for character — or null. Never paraphrase an option and never answer with text that is not in the list.
3. Questions about work authorization, visa sponsorship, security clearance, criminal history, citizenship, age, or salary expectations: answer null unless the profile explicitly states the fact. Do not assume or guess.
4. Never answer demographic questions (gender, ethnicity, race, disability, veteran status, sexual orientation, pronouns). Answer null.
5. For open-ended questions ("Why do you want to work here?", "Tell us about yourself"), write 2-4 genuine first-person sentences grounded ONLY in the real companies, projects, technologies, and accomplishments listed in the profile. If the profile has nothing relevant, answer null rather than writing generic filler.
6. Never mention AI, this tool, or that answers were generated.

Respond with ONLY a JSON array, no wrapper object, no markdown:
[{"label": "exact label text as given", "answer": "written answer or verbatim option or null"}]`

    const userPrompt = `Applicant profile:
${contextStr}

Resume:
${resumeText.slice(0, 3000)}

Form questions:

${formatQuestions(aiQuestions)}

Return one JSON entry per question, preserving each label exactly. Use null for anything the profile does not answer.`

    const parsed = await withTimeout(
      generateJSON<unknown>(systemPrompt, userPrompt),
      30000,
      'extension-ai-fill'
    )

    let aiFields: FieldAnswer[]
    if (Array.isArray(parsed)) {
      aiFields = parsed as FieldAnswer[]
    } else if (parsed && typeof parsed === 'object' && 'fields' in parsed) {
      aiFields = (parsed as { fields: FieldAnswer[] }).fields
    } else {
      aiFields = []
    }

    // Server-side validation: sanitize, re-apply deterministic guards, and
    // snap dropdown answers to exact option text (or drop them).
    const optionsByLabel = new Map(aiQuestions.filter(q => q.options?.length).map(q => [q.label, q.options as string[]]))
    const validated: FieldAnswer[] = []
    for (const f of aiFields) {
      if (typeof f?.label !== 'string') continue
      let answer = sanitizeAnswer(f.answer)
      if (answer && (DEMOGRAPHIC_RE.test(f.label) || TIER1_LABEL_RE.test(f.label))) answer = null
      const options = optionsByLabel.get(f.label)
      if (answer && options) answer = validateOptionAnswer(answer, options)
      if (answer) validated.push({ label: f.label, answer })
    }

    const fields = [...resolved.filter(f => f.answer !== null), ...validated]
    return ok({ fields })
  } catch (e) {
    // AI failure shouldn't zero out the deterministic answers
    const fields = resolved.filter(f => f.answer !== null)
    if (fields.length) return ok({ fields })
    return serverError(e)
  }
}
