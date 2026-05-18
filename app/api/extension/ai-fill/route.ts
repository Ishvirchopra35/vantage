import { createClient } from '@supabase/supabase-js'
import { ok, unauthorized, serverError } from '@/lib/apiResponse'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { generateJSONCerebras } from '@/lib/ai'
import { withTimeout } from '@/lib/withTimeout'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Question {
  label: string
  tag: string
  type: string | null
  options?: string[]
  fieldId?: string
}

interface FieldAnswer {
  label: string
  answer: string | null
}

function formatQuestions(questions: Question[]): string {
  return questions.map(q => {
    if (q.options?.length) {
      return `Q: "${q.label}"\n  Options: ${q.options.join(' | ')}\n  → Pick exactly one option text, or "SKIP" if not applicable`
    }
    return `Q: "${q.label}"\n  → Write a natural answer`
  }).join('\n\n')
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

  let body: { questions: Question[]; jobUrl?: string }
  try {
    body = await request.json()
  } catch {
    return serverError(new Error('Invalid request body'))
  }

  const { questions = [] } = body

  if (!questions.length) {
    return ok({ fields: [] })
  }

  try {
    const ctx = await buildUserContext(profile.id as string)
    const contextStr = formatContextForPrompt(ctx)
    const resumeText = ctx.baseResume ?? 'No resume uploaded'

    const systemPrompt = `You are helping a job applicant fill out an application form. Given their profile and resume, generate appropriate answers for each form field. Return ONLY valid JSON with no other text.

For dropdown questions, you MUST return the answer as EXACTLY one of the provided option strings — copy it verbatim. Do not paraphrase. If the answer is "SKIP", return null instead.

For demographic questions (gender, ethnicity, sexual orientation, disability, veteran status), use the user's actual profile information if available. Only choose "I don't wish to answer" as a last resort when the information is genuinely unknown.

Examples:
- gender: if the user's name or profile suggests male → pick "Male"
- veteran: almost always "No, I am not a veteran" unless stated otherwise
- disability: almost always "No" unless stated otherwise
- transgender: almost always "No" unless stated otherwise`

    const userPrompt = `Here is the applicant's information:
${contextStr}

Resume:
${resumeText.slice(0, 3000)}

Here are the form fields to fill:

${formatQuestions(questions)}

Rules for non-dropdown fields:
- Work authorization: "Yes"
- Visa sponsorship needed: "No"
- Salary comfort / non-compete: "Yes" / "No" respectively
- How did you hear: "LinkedIn"
- Open-ended questions: 2-3 genuine sentences from their actual experience
- Unknown info: null

Return a JSON array — one entry per question, preserving the exact label:
[{ "label": "exact label text", "answer": "verbatim option or written answer or null" }]`

    const fields = await withTimeout(
      generateJSONCerebras<FieldAnswer[]>(systemPrompt, userPrompt),
      30000,
      'extension-ai-fill'
    )

    return ok({ fields })
  } catch (e) {
    return serverError(e)
  }
}
