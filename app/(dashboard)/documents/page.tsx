import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DocumentsClient from '@/components/DocumentsClient'

export const metadata = {
  title: 'Documents',
}

export interface TailorChangeRow {
  section: string
  entry: string
  original: string
  tailored: string
  reason: string
}

// Tailored resumes ship with content nulled out - users only ever see the
// per-bullet changes. Cover letters keep their full content.
export interface DocumentRow {
  id: string
  type: 'tailored_resume' | 'cover_letter'
  content: string | null
  changes: TailorChangeRow[] | null
  skill_gaps: string[] | null
  created_at: string
  job_id: string | null
  jobs: { title: string | null; company: string | null } | Array<{ title: string | null; company: string | null }> | null
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const [{ data }, { data: apps }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, type, content, changes, skill_gaps, created_at, job_id, jobs(title, company)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('applications')
      .select('job_id')
      .eq('user_id', user.id)
      .is('deleted_at', null),
  ])

  // Only documents belonging to tracked applications are listed - tailoring
  // runs that were never logged as applications stay out of the page.
  const trackedJobIds = new Set(
    ((apps ?? []) as { job_id: string | null }[]).map((a) => a.job_id).filter(Boolean)
  )

  // Strip the full tailored-resume text before it reaches the client - it is
  // internal-only (ATS scoring, auto-fill); users see the per-bullet diff.
  const documents = ((data ?? []) as DocumentRow[])
    .filter((doc) => doc.job_id !== null && trackedJobIds.has(doc.job_id))
    .map((doc) => (doc.type === 'tailored_resume' ? { ...doc, content: null } : doc))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="dashboard-page">
        <DocumentsClient documents={documents} />
      </div>
    </div>
  )
}
