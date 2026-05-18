// SQL migration required before using this route:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extension_token text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extension_token_created_at timestamptz;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;

import { createClient } from '@supabase/supabase-js'
import { ok, unauthorized } from '@/lib/apiResponse'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface Kit {
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  linkedin: string | null
  referralSource: string
  coverLetter: string | null
  answers: Record<string, string>
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
    .select('id, full_name, email, phone, linkedin_url')
    .eq('extension_token', token)
    .limit(1)
    .single()

  console.error('[extension/kit] Profile query error:', profileError?.message ?? 'none')
  console.error('[extension/kit] Profile found:', !!profile)

  if (profileError || !profile) return unauthorized()

  const jobUrl = new URL(request.url).searchParams.get('url') ?? ''

  let coverLetter: string | null = null
  let answers: Record<string, string> = {}

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

  const kit: Kit = {
    firstName,
    lastName,
    fullName,
    email: profile.email as string | null,
    phone: profile.phone as string | null,
    linkedin: profile.linkedin_url as string | null,
    referralSource: 'LinkedIn',
    coverLetter,
    answers,
  }

  return ok({ kit })
}
