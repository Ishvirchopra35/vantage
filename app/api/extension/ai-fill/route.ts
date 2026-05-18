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
}

interface FieldAnswer {
  label: string
  answer: string | null
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

    const systemPrompt = `You are helping a job applicant fill out an application form. Given their profile and resume, generate appropriate answers for each form field. Return ONLY valid JSON with no other text.`

    const userPrompt = `Here is the applicant's information:
${contextStr}

Resume:
${resumeText.slice(0, 3000)}

Here are the form fields that need to be filled (label, field type):
${JSON.stringify(questions, null, 2)}

For each field, provide the best answer based on the applicant's information.
- For Yes/No dropdowns about work authorization: answer "Yes" for authorized, "No" for sponsorship needed
- For salary comfort questions: answer "Yes"
- For non-compete questions: answer "No"
- For "how did you hear": answer "LinkedIn"
- For open-ended questions: write 2-3 genuine sentences based on their actual experience
- For fields where you don't have enough info: return null

Return JSON array:
[{ "label": "exact label from input", "answer": "your answer or null" }]`

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
