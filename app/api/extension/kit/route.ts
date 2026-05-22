// SQL migration required before using this route:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extension_token text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extension_token_created_at timestamptz;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_url text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_url text;

import { createClient } from '@supabase/supabase-js'
import { ok, unauthorized } from '@/lib/apiResponse'
import { generateJSON } from '@/lib/ai'
import { withTimeout } from '@/lib/withTimeout'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface WorkExperienceEntry {
  company: string
  title: string
  start_date: string
  end_date: string | null
  current: boolean
  location: string
  bullets: string[]
}

interface ProjectEntry {
  name: string
  description: string
  url: string | null
  tech_stack: string[]
  bullets: string[]
}

interface Kit {
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  linkedin: string | null
  portfolio: string
  github: string
  location: string
  referralSource: string
  coverLetter: string | null
  answers: Record<string, string>
  applicationQuestions: Record<string, string>
  experience: WorkExperienceEntry[]
  projects: ProjectEntry[]
}

export async function GET(request: Request): Promise<Response> {
  // Headers are case-insensitive per spec — check both casings to be safe
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')

  console.error('[extension/kit] Authorization header present:', !!authHeader)
  console.error('[extension/kit] Header value (first 20):', authHeader?.slice(0, 20))

  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[extension/kit] Missing or malformed Bearer header')
    return unauthorized()
  }

  const token = authHeader.slice(7).trim()
  console.error('[extension/kit] Token extracted (first 8):', token.slice(0, 8), '... length:', token.length)

  if (!token) {
    console.error('[extension/kit] Empty token after extraction')
    return unauthorized()
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, linkedin_url, portfolio_url, github_url, experience, projects')
    .eq('extension_token', token)
    .limit(1)
    .single()

  console.error('[extension/kit] Profile query error:', profileError?.message ?? 'none')
  console.error('[extension/kit] Profile found:', !!profile)

  if (profileError || !profile) return unauthorized()

  const jobUrl = new URL(request.url).searchParams.get('url') ?? ''

  let coverLetter: string | null = null
  let answers: Record<string, string> = {}
  let applicationQuestions: Record<string, string> = {}

  if (jobUrl) {
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, company, key_responsibilities, company_description')
      .eq('user_id', profile.id)
      .eq('url', jobUrl)
      .limit(1)
      .single()

    if (job) {
      const [docResult, questionsResult] = await Promise.all([
        supabase
          .from('documents')
          .select('content')
          .eq('user_id', profile.id)
          .eq('job_id', job.id)
          .eq('type', 'cover_letter')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('application_questions')
          .select('question, user_edited_answer, generated_answer')
          .eq('user_id', profile.id)
          .eq('job_id', job.id),
      ])

      if (docResult.data?.content) coverLetter = docResult.data.content

      if (questionsResult.data) {
        for (const q of questionsResult.data as Array<{ question: string; user_edited_answer: string | null; generated_answer: string | null }>) {
          const answer = q.user_edited_answer ?? q.generated_answer ?? ''
          if (answer) answers[q.question] = answer
        }
      }

      const jobTitle = (job as Record<string, unknown>).title as string | null
      const jobCompany = (job as Record<string, unknown>).company as string | null
      if (jobTitle && jobCompany) {
        try {
          const questionsPrompt = `Generate brief, authentic 2-3 sentence answers for these common job application questions for a candidate applying to ${jobTitle} at ${jobCompany}.
Return JSON with keys being short question identifiers and values being the answers.
Questions to answer:
- excited: "What excites you about this position?"
- goals: "How does this align with your long-term career goals?"
- why_company: "Why do you want to work here?"
- contribution: "What would you contribute to our team?"

Keep answers genuine, specific to ${jobCompany}, and under 3 sentences each.`

          applicationQuestions = await withTimeout(
            generateJSON<Record<string, string>>(
              'You are a job application assistant. Generate authentic, specific answers for common application questions.',
              questionsPrompt
            ),
            15000,
            'application-questions'
          )
        } catch {
          // Non-critical — proceed without generated answers
        }
      }
    }
  }

  const fullName = (profile.full_name as string | null) ?? ''
  const nameParts = fullName.trim().split(/\s+/)
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ')

  const kit: Kit = {
    firstName,
    lastName,
    fullName,
    email: profile.email as string | null,
    phone: profile.phone as string | null,
    linkedin: profile.linkedin_url as string | null,
    portfolio: (profile.portfolio_url as string | null) ?? '',
    github: (profile.github_url as string | null) ?? '',
    location: '',
    referralSource: 'LinkedIn',
    coverLetter,
    answers,
    applicationQuestions,
    experience: (profile.experience as WorkExperienceEntry[] | null) ?? [],
    projects: (profile.projects as ProjectEntry[] | null) ?? [],
  }

  return ok({ kit })
}
