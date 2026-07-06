// SQL migration required before using this route:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extension_token text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extension_token_created_at timestamptz;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_url text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_url text;
// Optional (kit.location stays empty until it exists):
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location text;
// Optional (kit education degree stays null until it exists):
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS degree text;

import { createClient } from '@supabase/supabase-js'
import { ok, unauthorized } from '@/lib/apiResponse'

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

interface EducationEntry {
  school: string
  graduation_year: number | null
  degree: string | null
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
  pronouns: string | null
  referralSource: string
  skills: string[]
  education: EducationEntry[]
  coverLetter: string | null
  answers: Record<string, string>
  experience: WorkExperienceEntry[]
  projects: ProjectEntry[]
}

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return unauthorized()

  const token = authHeader.slice(7).trim()
  if (!token) return unauthorized()

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, linkedin_url, portfolio_url, github_url, skills, university, graduation_year, experience, projects')
    .eq('extension_token', token)
    .limit(1)
    .single()

  if (profileError || !profile) return unauthorized()

  // location and degree are optional migrations - queried separately so
  // missing columns degrade to empty values instead of a failed request.
  let location = ''
  let degree: string | null = null
  const { data: extraRow, error: extraError } = await supabase
    .from('profiles')
    .select('location, degree')
    .eq('id', profile.id)
    .limit(1)
    .single()
  if (!extraError && extraRow) {
    if (typeof extraRow.location === 'string') location = extraRow.location
    if (typeof extraRow.degree === 'string' && extraRow.degree) degree = extraRow.degree
  } else {
    const { data: locationRow, error: locationError } = await supabase
      .from('profiles')
      .select('location')
      .eq('id', profile.id)
      .limit(1)
      .single()
    if (!locationError && locationRow && typeof locationRow.location === 'string') {
      location = locationRow.location
    }
  }

  const jobUrl = new URL(request.url).searchParams.get('url') ?? ''

  let coverLetter: string | null = null
  const answers: Record<string, string> = {}

  if (jobUrl) {
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
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
    }
  }

  const fullName = (profile.full_name as string | null) ?? ''
  const nameParts = fullName.trim().split(/\s+/)
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ')

  const university = profile.university as string | null
  const graduationYear = profile.graduation_year as number | null

  const kit: Kit = {
    firstName,
    lastName,
    fullName,
    email: profile.email as string | null,
    phone: profile.phone as string | null,
    linkedin: profile.linkedin_url as string | null,
    portfolio: (profile.portfolio_url as string | null) ?? '',
    github: (profile.github_url as string | null) ?? '',
    location,
    // No pronouns column exists - always null so the extension never guesses
    pronouns: null,
    referralSource: 'Job Board',
    skills: (profile.skills as string[] | null) ?? [],
    education: university ? [{ school: university, graduation_year: graduationYear, degree }] : [],
    coverLetter,
    answers,
    experience: (profile.experience as WorkExperienceEntry[] | null) ?? [],
    projects: (profile.projects as ProjectEntry[] | null) ?? [],
  }

  return ok({ kit })
}
