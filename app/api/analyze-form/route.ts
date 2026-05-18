import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { generateJSON } from '@/lib/ai'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { withTimeout } from '@/lib/withTimeout'

interface FormField {
  label: string
  answer: string | null
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json()
  const validation = validateBody<{ url: string; jobId?: string }>(body, ['url'])
  if (!validation.valid) return err(validation.error, 400)
  const { url } = validation.data

  try {
    // Fetch form content via Jina.ai reader (free, no API key)
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
    })
    if (!jinaRes.ok) {
      await logRoute('analyze-form', user.id, Date.now() - start, 422)
      return err('Could not fetch the form URL. Make sure it is a publicly accessible page.', 422)
    }
    const formText = await jinaRes.text()

    const ctx = await buildUserContext(user.id)
    const contextStr = formatContextForPrompt(ctx)

    const systemPrompt = `You are helping a job applicant fill out an online application form. Extract every visible form field from the page content and generate the best possible answer for each field based on the applicant's profile.

Respond with ONLY a JSON array, no wrapper object, no markdown:
[{"label": "field label", "answer": "answer or null"}]`

    const userPrompt = `Applicant profile:
${contextStr}

Form page content:
${formText.slice(0, 4000)}

Extract all form fields (text inputs, textareas, dropdowns, checkboxes) visible on this page and generate the best answer for each based on the applicant's profile. Return null for fields you cannot answer confidently.

Rules:
- Work authorization / legally authorized to work: "Yes"
- Visa sponsorship required: "No"
- How did you hear: "LinkedIn"
- Veteran status: "No, I am not a veteran" unless stated otherwise
- Disability: "No" unless stated otherwise

Return a bare JSON array, one entry per field, with the exact label text as shown on the form.`

    const fields = await withTimeout(
      generateJSON<FormField[]>(systemPrompt, userPrompt),
      30000,
      'analyze-form'
    )

    const normalized: FormField[] = Array.isArray(fields)
      ? fields
      : (fields && typeof fields === 'object' && Array.isArray((fields as Record<string, unknown>).fields))
        ? (fields as { fields: FormField[] }).fields
        : []

    await logRoute('analyze-form', user.id, Date.now() - start, 200)
    return ok({ fields: normalized })
  } catch (e) {
    await logRoute('analyze-form', user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
