import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DocumentsClient from '@/components/DocumentsClient'

export const metadata = {
  title: 'Documents - Vantage',
}

export interface DocumentRow {
  id: string
  type: 'tailored_resume' | 'cover_letter'
  content: string
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

  const { data } = await supabase
    .from('documents')
    .select('id, type, content, skill_gaps, created_at, job_id, jobs(title, company)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const documents = (data ?? []) as DocumentRow[]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex w-full flex-col px-4 py-12">
        <div className="w-full">
          <DocumentsClient documents={documents} />
        </div>
      </div>
    </div>
  )
}
