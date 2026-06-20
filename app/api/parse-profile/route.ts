import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { generateJSON } from '@/lib/ai'
import { withTimeout } from '@/lib/withTimeout'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'

interface WorkExperience {
  company: string
  title: string
  start_date: string
  end_date: string | null
  current: boolean
  location: string
  bullets: string[]
}

interface Project {
  name: string
  description: string
  url: string | null
  tech_stack: string[]
  bullets: string[]
}

interface ParsedProfile {
  full_name: string
  university: string | null
  graduation_year: number | null
  years_experience: number | null
  linkedin_url: string | null
  skills: string[]
  target_roles: string[]
  experience: WorkExperience[]
  projects: Project[]
}

const SYSTEM_PROMPT = `You are a resume parser. Extract structured profile information from resume text. Return ONLY valid JSON.`

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const rateLimit = await checkRateLimit({
    key: 'parse-profile',
    userId: user.id,
    maxRequests: 10,
    windowMinutes: 60,
  })
  if (!rateLimit.allowed) {
    await logRoute('/api/parse-profile', user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining)
  }

  const body = await request.json().catch(() => null)
  const validation = validateBody<{ rawText: string }>(body, ['rawText'])
  if (!validation.valid) return err(validation.error, 400)
  const { rawText } = validation.data

  const userPrompt = `Extract the following fields from this resume text and return as JSON:
- full_name: string (the candidate's full name)
- university: string or null
- graduation_year: number or null (4-digit year)
- years_experience: number or null (total years of work experience, 0 if student/no experience)
- linkedin_url: string or null (only if explicitly present in the text)
- skills: string[] (all technical skills, languages, frameworks, and tools mentioned)
- target_roles: string[] (infer from job titles held and objective/summary section, max 3)
- experience: array of work experiences, each with:
  - company (string)
  - title (string)
  - start_date (string, "YYYY-MM" format)
  - end_date (string, "YYYY-MM" format, or null if current)
  - current (boolean)
  - location (string)
  - bullets (array of strings — the bullet points / responsibilities)
- projects: array of projects, each with:
  - name (string)
  - description (string, one sentence)
  - url (string or null)
  - tech_stack (array of strings)
  - bullets (array of strings — key accomplishments)

Return the full profile as one JSON object including all of these fields.

Resume text:
${rawText}`

  let parsed: ParsedProfile
  try {
    parsed = await withTimeout(
      generateJSON<ParsedProfile>(SYSTEM_PROMPT, userPrompt),
      30000,
      'parse-profile'
    )
  } catch (e) {
    await logRoute('/api/parse-profile', user.id, Date.now() - start, 500)
    return serverError(e)
  }

  // Build upsert payload — only include non-null/non-empty parsed fields
  // so we never overwrite existing profile data with nulls
  const upsertPayload: Record<string, unknown> = { id: user.id }
  if (parsed.full_name) upsertPayload.full_name = parsed.full_name
  if (parsed.university) upsertPayload.university = parsed.university
  if (parsed.graduation_year != null) upsertPayload.graduation_year = parsed.graduation_year
  if (parsed.years_experience != null) upsertPayload.years_experience = parsed.years_experience
  if (parsed.linkedin_url) upsertPayload.linkedin_url = parsed.linkedin_url
  if (parsed.skills?.length) upsertPayload.skills = parsed.skills
  if (parsed.target_roles?.length) upsertPayload.target_roles = parsed.target_roles.slice(0, 3)
  upsertPayload.experience = parsed.experience || []
  upsertPayload.projects = parsed.projects || []

  const supabase = await createClient()
  const { data: upsertedProfile, error: upsertError } = await supabase
    .from('profiles')
    .upsert(upsertPayload, { onConflict: 'id' })
    .select('id, full_name, university, graduation_year, years_experience, linkedin_url, skills, target_roles, experience, projects')
    .single()

  if (upsertError) {
    await logRoute('/api/parse-profile', user.id, Date.now() - start, 500)
    return serverError(upsertError)
  }

  await logRoute('/api/parse-profile', user.id, Date.now() - start, 200)
  return ok({ profile: upsertedProfile })
}
