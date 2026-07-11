'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ArrowIcon from '@/components/ui/ArrowIcon'
import PageHeader from '@/components/ui/PageHeader'

// --- Types -------------------------------------------------------------------

interface Job {
  id: string
  url: string
  title: string
  company: string
  location: string
  employment_type: string
  required_skills: string[]
  nice_to_have_skills: string[]
  keywords: string[]
  company_description: string
  key_responsibilities: string[]
  years_experience_required: number | null
}

interface ATSScore {
  id: string
  overall_score: number
  keyword_score: number
  format_score: number
  experience_score: number
  skills_score: number
  missing_keywords: string[]
  present_keywords: string[]
  suggestions: string[]
}

interface Doc {
  id: string
  content: string
}

interface TailorChange {
  section: string
  entry: string
  original: string
  tailored: string
  reason: string
}

// --- Helpers -----------------------------------------------------------------

function scoreColor(n: number): string {
  if (n >= 75) return 'var(--score-green)'
  if (n >= 50) return 'var(--score-amber)'
  return 'var(--score-red)'
}

function scoreLabel(n: number): string {
  if (n >= 75) return 'Strong'
  if (n >= 50) return 'Fair'
  return 'Weak'
}

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const fetchOptions: RequestInit = {
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      credentials: (options && 'credentials' in options) ? (options as any).credentials : 'include',
      ...options,
    }

    const res = await fetch(url, fetchOptions)
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || `Error ${res.status}` }
    return { data: json as T, error: null }
  } catch {
    return { data: null, error: 'Network error. Please try again.' }
  }
}

// --- Spinner -----------------------------------------------------------------

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '13px',
        height: '13px',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  )
}

// --- Style constants ---------------------------------------------------------

const card = {
  background: 'var(--card)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '24px',
  marginTop: '16px',
}

const inputStyle = {
  background: 'var(--card-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius)',
  padding: '12px 16px',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  width: '100%',
}

const primaryBtn = {
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '12px 24px',
  fontFamily: 'var(--font-display)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'opacity 0.15s',
  minHeight: '44px',
}

const secondaryBtn = {
  background: 'var(--card-raised)',
  color: 'var(--text)',
  border: 'none',
  borderRadius: '10px',
  padding: '10px 18px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '44px',
}

const badge = {
  background: 'var(--card-raised)',
  color: 'var(--text)',
  borderRadius: '20px',
  padding: '2px 7px',
  fontSize: '10px',
  fontWeight: 500,
}

const missingBadge = {
  background: 'rgba(239,68,68,0.12)',
  color: 'var(--score-red)',
  border: 'none',
  borderRadius: '20px',
  padding: '2px 7px',
  fontSize: '10px',
  fontWeight: 500,
}

const presentBadge = {
  background: 'rgba(34,197,94,0.12)',
  color: 'var(--score-green)',
  border: 'none',
  borderRadius: '20px',
  padding: '2px 7px',
  fontSize: '10px',
  fontWeight: 500,
}

const smallSecondaryBtn = {
  background: 'var(--card-raised)',
  color: 'var(--muted)',
  border: 'none',
  borderRadius: '8px',
  padding: '5px 12px',
  fontSize: '12px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}

// --- Page ---------------------------------------------------------------------

export default function TailorPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [jobUrl, setJobUrl] = useState('')
  const [useTextarea, setUseTextarea] = useState(false)
  const [jobText, setJobText] = useState('')
  const [parsedJob, setParsedJob] = useState<Job | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Step 2
  const [remainingUses, setRemainingUses] = useState<Record<string, number> | null>(null)
  const [baseResumeId, setBaseResumeId] = useState<string | null>(null)
  const [baseAtsScore, setBaseAtsScore] = useState<ATSScore | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Step 3
  const [tailoredDoc, setTailoredDoc] = useState<Doc | null>(null)
  const [tailorChanges, setTailorChanges] = useState<TailorChange[]>([])
  const [tailoredAtsScore, setTailoredAtsScore] = useState<ATSScore | null>(null)
  const [coverDoc, setCoverDoc] = useState<Doc | null>(null)
  const [activeTab, setActiveTab] = useState<'ats' | 'resume' | 'cover'>('resume')
  const [copied, setCopied] = useState<'resume' | 'cover' | null>(null)
  const [copiedBullet, setCopiedBullet] = useState<number | null>(null)

  // Log application
  const [logCompany, setLogCompany] = useState('')
  const [logRole, setLogRole] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logSuccess, setLogSuccess] = useState(false)

  // Loading
  const [loading, setLoading] = useState({ parse: false, ats: false, tailor: false, cover: false })
  const [autoLoading, setAutoLoading] = useState(false)

  // -- Auto-fill from query params ----------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('prefill')
    const jobId = params.get('jobId')

    if (prefill) {
      const decoded = decodeURIComponent(prefill)
      setJobUrl(decoded)
      void parseJob(decoded)
    } else if (jobId) {
      void loadJobById(jobId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // -- Actions ------------------------------------------------------------------

  async function parseJob(overrideUrl?: string) {
    const input = overrideUrl ?? (useTextarea ? jobText.trim() : jobUrl.trim())
    if (!input) return
    setParseError(null)
    setLoading(l => ({ ...l, parse: true }))

    // overrideUrl is always a URL, not raw text
    const body = (!overrideUrl && useTextarea) ? { rawText: input } : { url: input }
    const { data, error } = await apiFetch<{ job: Job }>('/api/parse-job', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    setLoading(l => ({ ...l, parse: false }))

    if (error || !data?.job) {
      setParseError(error || 'We could not read this job posting.')
      return
    }
    setParsedJob(data.job)
  }

  async function loadJobById(id: string) {
    setAutoLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: job } = await supabase
        .from('jobs')
        .select('id, url, title, company, location, employment_type, required_skills, nice_to_have_skills, keywords, company_description, key_responsibilities, years_experience_required')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!job) {
        setParseError('Job not found. Paste the URL or description below to load it.')
        return
      }

      await goToStep2(job as Job)
    } finally {
      setAutoLoading(false)
    }
  }

  async function goToStep2(jobOverride?: Job) {
    const job = jobOverride ?? parsedJob
    if (!job) return
    if (jobOverride) setParsedJob(jobOverride)
    setLogCompany(job.company || '')
    setLogRole(job.title || '')

    const supabase = createClient()
    const [limitsRes, userRes] = await Promise.all([
      apiFetch<{ limits: Record<string, number> }>('/api/remaining-uses'),
      supabase.auth.getUser(),
    ])

    if (limitsRes.data?.limits) setRemainingUses(limitsRes.data.limits)

    const userId = userRes.data?.user?.id
    if (userId) {
      const { data: resumeRow } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', userId)
        .eq('is_base', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (resumeRow?.id) setBaseResumeId(resumeRow.id)
    }

    setStep(2)
  }

  async function checkAts() {
    if (!parsedJob) return
    setActionError(null)
    if (!baseResumeId) {
      setActionError('No base resume found. Upload a resume in your profile first.')
      return
    }
    setLoading(l => ({ ...l, ats: true }))
    const { data, error } = await apiFetch<{ score: ATSScore }>('/api/ats-score', {
      method: 'POST',
      body: JSON.stringify({ jobId: parsedJob.id, resumeId: baseResumeId }),
    })
    setLoading(l => ({ ...l, ats: false }))
    if (error || !data?.score) {
      setActionError(error || 'Could not compute ATS score.')
      return
    }
    setBaseAtsScore(data.score)
  }

  async function tailorResume() {
    if (!parsedJob) return
    setActionError(null)
    if (!baseResumeId) {
      setActionError('No base resume found. Upload your resume on the Profile page first.')
      return
    }
    setLoading(l => ({ ...l, tailor: true }))
    const { data, error } = await apiFetch<{
      document: Doc
      changes: TailorChange[]
      skillGaps: string[]
      atsScore: ATSScore | null
    }>('/api/tailor-resume', {
      method: 'POST',
      body: JSON.stringify({ jobId: parsedJob.id }),
    })
    setLoading(l => ({ ...l, tailor: false }))
    if (error || !data?.document) {
      setActionError(error || 'Could not tailor resume. Please try again.')
      return
    }
    setTailoredDoc(data.document)
    setTailorChanges(data.changes ?? [])
    if (data.atsScore) setTailoredAtsScore(data.atsScore)
    setStep(3)
    setActiveTab('resume')
  }

  async function generateCoverLetter() {
    if (!parsedJob) return
    setActionError(null)
    setLoading(l => ({ ...l, cover: true }))
    const { data, error } = await apiFetch<{ document: Doc }>('/api/generate-cover-letter', {
      method: 'POST',
      body: JSON.stringify({ jobId: parsedJob.id }),
    })
    setLoading(l => ({ ...l, cover: false }))
    if (error || !data?.document) {
      setActionError(error || 'Could not generate cover letter. Please try again.')
      return
    }
    setCoverDoc(data.document)
    setStep(3)
    setActiveTab('cover')
  }

  function isHtmlContent(content: string): boolean {
    return content.trim().startsWith('<')
  }

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  async function copyToClipboard(text: string, type: 'resume' | 'cover') {
    const plain = isHtmlContent(text) ? stripHtml(text) : text
    await navigator.clipboard.writeText(plain)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  async function copyBullet(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopiedBullet(idx)
    setTimeout(() => setCopiedBullet(null), 2000)
  }

  // Group changes by resume section, then by parent entry (company / project
  // name), preserving the order they appear in
  interface EntryGroup { name: string; items: { change: TailorChange; idx: number }[] }
  interface SectionGroup { name: string; entries: EntryGroup[] }

  function groupChanges(changes: TailorChange[]): SectionGroup[] {
    const sections: SectionGroup[] = []
    changes.forEach((change, idx) => {
      let section = sections.find(s => s.name === change.section)
      if (!section) {
        section = { name: change.section, entries: [] }
        sections.push(section)
      }
      const entryName = change.entry || ''
      let entry = section.entries.find(e => e.name === entryName)
      if (!entry) {
        entry = { name: entryName, items: [] }
        section.entries.push(entry)
      }
      entry.items.push({ change, idx })
    })
    return sections
  }

  function downloadAsPDF(content: string, filename: string) {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    const isHtml = isHtmlContent(content)
    const bodyContent = isHtml ? content : `<pre>${escapeHtml(content)}</pre>`

    const pageStyles = `
      @page { margin: 0; size: letter; }
      body {
        margin: 0.5in 0.6in;
        font-family: 'Times New Roman', Times, serif;
        font-size: 11pt;
        line-height: 1.5;
        color: #000;
        background: #fff;
      }
      h1 { font-size: 18pt; margin: 0 0 4pt; }
      h2 { font-size: 12pt; margin: 12pt 0 4pt; border-bottom: 1px solid #000; padding-bottom: 2pt; }
      p { margin: 0 0 6pt; }
      ul { margin: 2pt 0 6pt; padding-left: 18pt; }
      li { margin-bottom: 2pt; }
      a { color: inherit; text-decoration: none; }
      pre { white-space: pre-wrap; font-family: inherit; font-size: 11pt; line-height: 1.5; margin: 0; }
    `

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title><style>${pageStyles}</style></head><body>${bodyContent}</body></html>`

    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        // ignore
      }
      setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 500)
    }, 250)
  }

  function escapeHtml(str: string) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  async function logApplication() {
    if (!parsedJob || !logCompany?.trim() || !logRole?.trim()) return
    setLogLoading(true)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) { setLogLoading(false); return }

    await supabase.from('applications').insert({
      user_id: userId,
      job_id: parsedJob.id,
      job_url: parsedJob.url || null,
      company: (logCompany || '').trim(),
      role: (logRole || '').trim(),
      status: 'applied',
      applied_date: new Date().toISOString().slice(0, 10),
      resume_doc_id: tailoredDoc?.id ?? null,
      cover_letter_doc_id: coverDoc?.id ?? null,
      ats_score_id: tailoredAtsScore?.id ?? baseAtsScore?.id ?? null,
    })

    setLogLoading(false)
    setLogSuccess(true)
  }

  // -- Shared sub-render ---------------------------------------------------------

  const displayScore = tailoredAtsScore ?? baseAtsScore

  function CollapsedJobHeader({ onBack }: { onBack: () => void }) {
    if (!parsedJob) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={onBack} aria-label="Back" style={{ ...secondaryBtn, padding: '8px 12px' }}><ArrowIcon direction="left" /></button>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{parsedJob.title}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{parsedJob.company}</div>
        </div>
      </div>
    )
  }

  // -- Render --------------------------------------------------------------------

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      <div className="dashboard-page">

        {/* -- Step 1: Parse job ----------------------------------------------- */}
        {step === 1 && (
          <div>
            <PageHeader
              title="Tailor your resume"
              subtitle="Paste a job URL. We'll read it, tailor your resume to match, score it against ATS systems (the software companies use to screen resumes), and generate a cover letter."
            />

            {/* Auto-load banner for jobId flow */}
            {autoLoading && (
              <div style={{
                marginBottom: '16px',
                padding: '10px 14px',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '10px',
                fontSize: '13px',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Spinner /> Loading job…
              </div>
            )}

            {/* Input row */}
            <div className="tailor-input-row">
              {!useTextarea && (
                <input
                  type="url"
                  className="input-gold-focus"
                  placeholder="https://jobs.company.com/senior-engineer"
                  value={jobUrl}
                  onChange={e => setJobUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') parseJob() }}
                  disabled={loading.parse}
                  style={{ ...inputStyle, flex: 1 }}
                />
              )}
              <button
                onClick={() => void parseJob()}
                disabled={loading.parse || (useTextarea ? !jobText.trim() : !jobUrl.trim())}
                className="btn-gold-hover"
                style={{
                  ...primaryBtn,
                  opacity: loading.parse || (useTextarea ? !jobText.trim() : !jobUrl.trim()) ? 0.5 : 1,
                }}
              >
                {loading.parse ? <Spinner /> : 'Analyze job'}
              </button>
            </div>

            {/* LinkedIn / Google Jobs hint */}
            {!useTextarea && jobUrl && (jobUrl.includes('linkedin.com') || jobUrl.includes('jobs.google.com') || jobUrl.includes('google.com/about/careers')) && (
              <div style={{
                marginTop: '10px',
                padding: '10px 14px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '10px',
                color: 'var(--score-amber)',
                fontSize: '13px',
              }}>
                LinkedIn and Google Jobs block automated access. Click "Paste the description directly" below and copy-paste the job text instead.
              </div>
            )}

            {/* Toggle paste mode */}
            <button
              onClick={() => setUseTextarea(!useTextarea)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '13px',
                cursor: 'pointer',
                marginTop: '10px',
                padding: '0',
              }}
            >
              {useTextarea ? <><ArrowIcon direction="left" /> Use a URL instead</> : <>URL not working? Paste the description directly <ArrowIcon /></>}
            </button>

            {/* Paste textarea */}
            {useTextarea && (
              <textarea
                className="input-gold-focus"
                placeholder="Paste the full job description here..."
                value={jobText}
                onChange={e => setJobText(e.target.value)}
                rows={10}
                style={{
                  ...inputStyle,
                  marginTop: '12px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                }}
              />
            )}

            {/* Parse error */}
            {parseError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                color: 'var(--score-red)',
                fontSize: '13px',
              }}>
                {parseError}
              </div>
            )}

            {/* Placeholder before a job is parsed */}
            {!parsedJob && !autoLoading && (
              <div style={{ textAlign: 'center', padding: '48px 24px 24px' }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
                  Paste a job URL above to get started
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  {['Resume tailored to the JD', 'ATS score before you apply', 'Cover letter in your voice'].map(hint => (
                    <div key={hint} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)' }}>
                      <span style={{ color: 'var(--score-green)', display: 'inline-flex', flexShrink: 0 }} aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 8 6 12 14 3" />
                        </svg>
                      </span>
                      {hint}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Job preview card */}
            {parsedJob && (
              <div style={{ ...card, marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                      {parsedJob.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                      {parsedJob.company} · {parsedJob.location}
                      {parsedJob.employment_type && ` · ${parsedJob.employment_type}`}
                    </div>
                  </div>
                  <button onClick={() => void goToStep2()} className="btn-gold-hover" style={primaryBtn}>Continue <ArrowIcon /></button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
                  {parsedJob.required_skills.slice(0, 8).map(s => (
                    <span key={s} style={badge}>{s}</span>
                  ))}
                  {parsedJob.required_skills.length > 8 && (
                    <span style={{ ...badge, color: 'var(--muted)' }}>
                      +{parsedJob.required_skills.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -- Step 2: Actions ------------------------------------------------- */}
        {step === 2 && parsedJob && (
          <div>
            {/* Collapsed job header + remaining uses */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button onClick={() => setStep(1)} aria-label="Back" style={{ ...secondaryBtn, padding: '8px 12px' }}><ArrowIcon direction="left" /></button>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{parsedJob.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{parsedJob.company}</div>
              </div>
              {remainingUses && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ ...badge, fontSize: '11px', color: 'var(--muted)' }}>
                    {remainingUses.tailoring === 999 ? '∞' : remainingUses.tailoring} tailorings left
                  </span>
                  <span style={{ ...badge, fontSize: '11px', color: 'var(--muted)' }}>
                    {remainingUses.cover_letter === 999 ? '∞' : remainingUses.cover_letter} cover letters left
                  </span>
                </div>
              )}
            </div>

            {/* No resume warning */}
            {!baseResumeId && (
              <div style={{
                padding: '14px 16px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '14px',
                color: 'var(--text)',
              }}>
                <strong style={{ color: 'var(--score-amber)' }}>No resume on file.</strong>{' '}
                <a href="/profile" style={{ color: 'var(--accent)' }}>
                  Go to Profile
                </a>{' '}
                to upload your base resume before tailoring.
              </div>
            )}

            {/* Three action buttons */}
            <div className="tailor-actions">
              <button
                onClick={checkAts}
                disabled={loading.ats}
                style={{ ...secondaryBtn, opacity: loading.ats ? 0.6 : 1 }}
              >
                {loading.ats ? <Spinner /> : 'Check ATS Score'}
              </button>
              <button
                onClick={tailorResume}
                disabled={loading.tailor}
                className="btn-gold-hover"
                style={{ ...primaryBtn, opacity: loading.tailor ? 0.6 : 1 }}
              >
                {loading.tailor ? <Spinner /> : 'Tailor My Resume'}
              </button>
              <button
                onClick={generateCoverLetter}
                disabled={loading.cover}
                style={{ ...secondaryBtn, opacity: loading.cover ? 0.6 : 1 }}
              >
                {loading.cover ? <Spinner /> : 'Generate Cover Letter'}
              </button>
            </div>

            {/* Action error */}
            {actionError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                color: 'var(--score-red)',
                fontSize: '13px',
              }}>
                {actionError}
              </div>
            )}

            {/* Inline base ATS score preview */}
            {baseAtsScore && (
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
                <div style={{
                  fontSize: '42px',
                  fontWeight: 800,
                  color: scoreColor(baseAtsScore.overall_score),
                  lineHeight: 1,
                  flexShrink: 0,
                }}>
                  {baseAtsScore.overall_score}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                    Base resume · {scoreLabel(baseAtsScore.overall_score)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                    Tailor your resume to improve this score
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -- Step 3: Results tabs -------------------------------------------- */}
        {step === 3 && parsedJob && (
          <div>
            <CollapsedJobHeader onBack={() => setStep(2)} />

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {(['ats', 'resume', 'cover'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab
                      ? '2px solid var(--accent)'
                      : '2px solid transparent',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? 'var(--text)' : 'var(--muted)',
                    cursor: 'pointer',
                    marginBottom: '-1px',
                  }}
                >
                  {tab === 'ats' ? 'ATS Score' : tab === 'resume' ? 'Tailored Resume' : 'Cover Letter'}
                </button>
              ))}
            </div>

            {/* -- ATS Score tab -- */}
            {activeTab === 'ats' && (
              <div style={card}>
                {displayScore ? (
                  <>
                    {/* Before/after banner */}
                    {baseAtsScore && tailoredAtsScore && (
                      <div style={{
                        padding: '10px 14px',
                        background: 'rgba(34,197,94,0.07)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: '10px',
                        marginBottom: '24px',
                        fontSize: '14px',
                        color: 'var(--text)',
                      }}>
                        Base:{' '}
                        <strong style={{ color: scoreColor(baseAtsScore.overall_score) }}>
                          {baseAtsScore.overall_score}
                        </strong>
                        {' '}<ArrowIcon />{' '}Tailored:{' '}
                        <strong style={{ color: scoreColor(tailoredAtsScore.overall_score) }}>
                          {tailoredAtsScore.overall_score}
                        </strong>
                        <span style={{ color: 'var(--score-green)', fontWeight: 600, marginLeft: '8px' }}>
                          (+{tailoredAtsScore.overall_score - baseAtsScore.overall_score} points)
                        </span>
                      </div>
                    )}

                    {/* Large score number */}
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                      <div style={{
                        fontSize: '80px',
                        fontWeight: 800,
                        color: scoreColor(displayScore.overall_score),
                        lineHeight: 1,
                      }}>
                        {displayScore.overall_score}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
                        {scoreLabel(displayScore.overall_score)} · out of 100
                        {tailoredAtsScore ? ' · tailored resume' : ' · base resume'}
                      </div>
                    </div>

                    {/* Sub-score progress bars */}
                    <div style={{ marginBottom: '28px' }}>
                      {[
                        { label: 'Keywords', value: displayScore.keyword_score },
                        { label: 'Experience', value: displayScore.experience_score },
                        { label: 'Format', value: displayScore.format_score },
                        { label: 'Skills', value: displayScore.skills_score },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{value}</span>
                          </div>
                          <div style={{
                            height: '6px',
                            background: 'var(--border)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${value}%`,
                              background: scoreColor(value),
                              borderRadius: '3px',
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Missing keywords */}
                    {displayScore.missing_keywords.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
                          Missing keywords
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {displayScore.missing_keywords.map(kw => (
                            <span key={kw} style={missingBadge}>{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Present keywords */}
                    {displayScore.present_keywords.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
                          Present keywords
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {displayScore.present_keywords.map(kw => (
                            <span key={kw} style={presentBadge}>{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Numbered suggestions */}
                    {displayScore.suggestions.length > 0 && (
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>
                          Suggestions
                        </div>
                        <ol style={{ paddingLeft: '20px', margin: 0 }}>
                          {displayScore.suggestions.map((s, i) => (
                            <li
                              key={i}
                              style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px', lineHeight: 1.6 }}
                            >
                              {s}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: '14px' }}>
                    <div style={{ marginBottom: '16px' }}>No ATS score yet.</div>
                    <button onClick={() => setStep(2)} style={secondaryBtn}>
                      Go back to check score
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* -- Tailored Resume tab: per-bullet diff view -- */}
            {activeTab === 'resume' && (
              <div style={card}>
                {tailoredDoc ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        {tailorChanges.length > 0
                          ? `${tailorChanges.length} bullet${tailorChanges.length === 1 ? '' : 's'} tailored for this job`
                          : 'Tailored resume'}
                      </div>
                      <button
                        onClick={() => copyToClipboard(tailoredDoc.content, 'resume')}
                        style={smallSecondaryBtn}
                        title="Copies the full updated resume text, ready to paste into Google Docs or Word"
                      >
                        {copied === 'resume' ? 'Copied!' : 'Copy all tailored bullets'}
                      </button>
                    </div>

                    {tailorChanges.length > 0 ? (
                      groupChanges(tailorChanges).map(group => (
                        <div key={group.name} style={{ marginBottom: '24px' }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '10px',
                          }}>
                            {group.name}
                          </div>
                          {group.entries.map(entry => (
                            <div key={entry.name || '(entry)'} style={{ marginBottom: '14px' }}>
                              {entry.name && (
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: 'var(--text)',
                                  marginBottom: '8px',
                                }}>
                                  {entry.name}
                                </div>
                              )}
                              {entry.items.map(({ change, idx }) => (
                                <div
                                  key={idx}
                                  style={{
                                    borderRadius: '10px',
                                    padding: '14px 8px',
                                    marginBottom: '10px',
                                    background: 'var(--card-raised)',
                                  }}
                                >
                                  <div style={{
                                    fontSize: '13px',
                                    color: 'var(--muted)',
                                    textDecoration: 'line-through',
                                    lineHeight: 1.6,
                                    marginBottom: '8px',
                                  }}>
                                    {change.original}
                                  </div>
                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <div style={{
                                      flex: 1,
                                      fontSize: '13px',
                                      color: 'var(--text)',
                                      lineHeight: 1.6,
                                      background: 'rgba(34,197,94,0.08)',
                                      border: '1px solid rgba(34,197,94,0.2)',
                                      borderRadius: '8px',
                                      padding: '8px 10px',
                                    }}>
                                      {change.tailored}
                                    </div>
                                    <button
                                      onClick={() => void copyBullet(change.tailored, idx)}
                                      style={{ ...smallSecondaryBtn, flexShrink: 0 }}
                                    >
                                      {copiedBullet === idx ? 'Copied!' : 'Copy bullet'}
                                    </button>
                                  </div>
                                  {change.reason && (
                                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                                      {change.reason}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                          No individual bullet changes were returned - full tailored text below.
                        </div>
                        <pre style={{
                          fontFamily: "'Courier New', Courier, monospace",
                          fontSize: '13px',
                          lineHeight: 1.7,
                          color: 'var(--text)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '600px',
                          overflowY: 'auto',
                          background: 'var(--card-raised)',
                          borderRadius: '10px',
                          padding: '16px',
                          margin: 0,
                        }}>
                          {isHtmlContent(tailoredDoc.content) ? stripHtml(tailoredDoc.content) : tailoredDoc.content}
                        </pre>
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: '14px' }}>
                    <div style={{ marginBottom: '16px' }}>No tailored resume yet.</div>
                    <button onClick={() => setStep(2)} style={secondaryBtn}>
                      Go back to tailor resume
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* -- Cover Letter tab -- */}
            {activeTab === 'cover' && (
              <div style={card}>
                {coverDoc ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <button
                          onClick={() => copyToClipboard(coverDoc.content, 'cover')}
                          style={smallSecondaryBtn}
                        >
                          {copied === 'cover' ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => downloadAsPDF(coverDoc.content, `${parsedJob.company} - ${parsedJob.title} - Cover Letter.pdf`)}
                          style={smallSecondaryBtn}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <span style={{ marginLeft: '6px' }}>Download PDF</span>
                        </button>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      lineHeight: 1.8,
                      color: 'var(--text)',
                      maxHeight: '600px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {coverDoc.content}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
                      No cover letter yet.
                    </div>
                    <button
                      onClick={generateCoverLetter}
                      disabled={loading.cover}
                      className="btn-gold-hover"
                      style={{ ...primaryBtn, opacity: loading.cover ? 0.6 : 1 }}
                    >
                      {loading.cover ? <Spinner /> : 'Generate Cover Letter'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* -- Log this application -- */}
            <div style={{ ...card, marginTop: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
                Log this application
              </div>
              {logSuccess ? (
                <div style={{ color: 'var(--score-green)', fontSize: '14px' }}>Application logged.</div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    placeholder="Company"
                    value={logCompany || ''}
                    onChange={e => setLogCompany(e.target.value)}
                    style={{ ...inputStyle, flex: '1 1 160px' }}
                  />
                  <input
                    placeholder="Role"
                    value={logRole || ''}
                    onChange={e => setLogRole(e.target.value)}
                    style={{ ...inputStyle, flex: '1 1 160px' }}
                  />
                  <button
                    onClick={logApplication}
                    disabled={logLoading || !logCompany?.trim() || !logRole?.trim()}
                    className="btn-gold-hover"
                    style={{
                      ...primaryBtn,
                      opacity: logLoading || !logCompany?.trim() || !logRole?.trim() ? 0.5 : 1,
                    }}
                  >
                    {logLoading ? <Spinner /> : 'Log'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
