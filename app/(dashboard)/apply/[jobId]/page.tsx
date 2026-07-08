'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ScoreBadge from '@/components/ui/ScoreBadge'
import Spinner from '@/components/ui/Spinner'
import SkeletonLoader from '@/components/ui/SkeletonLoader'
import ArrowIcon from '@/components/ui/ArrowIcon'

// --- Types --------------------------------------------------------------------

type AppStatus = 'applied' | 'interviewing' | 'offer' | 'rejected' | 'ghosted'

interface Job {
  id: string | null
  title: string
  company: string
  required_skills: string[] | null
  keywords: string[] | null
}

interface DocRow {
  id: string
  type: 'tailored_resume' | 'cover_letter'
  content: string
  created_at: string
}

interface AtsRow {
  id: string
  overall_score: number
}

interface AppRow {
  id: string
  status: AppStatus
  company: string
  role: string
  applied_date: string | null
  job_id: string | null
}

interface QuestionRow {
  id: string
  question: string
  generated_answer: string
  user_edited_answer: string | null
  is_used: boolean | null
  created_at: string
  localAnswer: string
}

// --- Status maps -------------------------------------------------------------

const STATUS_LABEL: Record<AppStatus, string> = {
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
}

const STATUS_COLOR: Record<AppStatus, string> = {
  applied: 'var(--gold-dim)',
  interviewing: 'rgba(34,197,94,0.1)',
  offer: 'rgba(34,197,94,0.15)',
  rejected: 'rgba(239,68,68,0.1)',
  ghosted: 'rgba(239,68,68,0.1)',
}

const STATUS_TEXT: Record<AppStatus, string> = {
  applied: 'var(--gold)',
  interviewing: 'var(--score-green)',
  offer: 'var(--score-green)',
  rejected: 'var(--score-red)',
  ghosted: 'var(--score-red)',
}

// --- Checklist ----------------------------------------------------------------

const CHECKLIST_ITEMS = [
  { key: 'resume' as const, label: 'Resume ready' },
  { key: 'cover' as const, label: 'Cover letter ready' },
  { key: 'questions' as const, label: 'All questions answered' },
  { key: 'form' as const, label: 'Application form filled' },
  { key: 'submit' as const, label: 'Ready to submit' },
]

type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]['key']

// --- Page ---------------------------------------------------------------------

export default function ApplyPrepPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string
  const supabase = useMemo(() => createClient(), [])

  // Page load
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // Data
  const [job, setJob] = useState<Job | null>(null)
  const [resumeDoc, setResumeDoc] = useState<DocRow | null>(null)
  const [coverDoc, setCoverDoc] = useState<DocRow | null>(null)
  const [atsScore, setAtsScore] = useState<AtsRow | null>(null)
  const [application, setApplication] = useState<AppRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])

  // Kit card copy buttons
  const [copiedResume, setCopiedResume] = useState(false)
  const [copiedCover, setCopiedCover] = useState(false)

  // Question generation
  const [questionInput, setQuestionInput] = useState('')
  const [generatingAnswer, setGeneratingAnswer] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Per-answer state
  const debounceRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({})
  const [copiedAnswers, setCopiedAnswers] = useState<Record<string, boolean>>({})

  // Checklist
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({
    resume: false, cover: false, questions: false, form: false, submit: false,
  })
  const [markingApplied, setMarkingApplied] = useState(false)

  // Auto-fill
  const [extensionInstalled, setExtensionInstalled] = useState(false)

  const allChecked = CHECKLIST_ITEMS.every(({ key }) => checklist[key])

  // --- Load --------------------------------------------------------------

  useEffect(() => {
    if (!jobId) return
    async function load() {
      setPageLoading(true)
      setPageError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // The route param is an opaque apply-target id. It is resolved
      // application-id-first (the auto-apply page links with an application id),
      // then falls back to a legacy jobs.id deep link.
      const param = jobId

      let resolvedJob: Job | null = null
      let resolvedApplication: AppRow | null = null
      // documents/ats_scores are keyed by job_id; null for manual targets.
      let dataJobId: string | null = null

      // Step 1: resolve the param as an application id.
      const appByIdRes = await supabase
        .from('applications')
        .select('id, status, company, role, applied_date, job_id')
        .eq('id', param)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

      if (appByIdRes.data) {
        const app = appByIdRes.data as AppRow
        resolvedApplication = app
        if (app.job_id) {
          // Job-linked application: load the real job and key docs/ats by job_id.
          const jobRes = await supabase
            .from('jobs')
            .select('id, title, company, required_skills, keywords')
            .eq('id', app.job_id)
            .eq('user_id', user.id)
            .maybeSingle()
          if (jobRes.data) {
            resolvedJob = jobRes.data as Job
            dataJobId = app.job_id
          } else {
            // Job row missing/inaccessible — synthesize from the application.
            resolvedJob = { id: null, title: app.role, company: app.company, required_skills: null, keywords: null }
          }
        } else {
          // Manual application (null job_id): synthesize a display job.
          // documents/ats_scores are keyed on job_id, so they resolve empty and
          // their existing empty states render.
          resolvedJob = { id: null, title: app.role, company: app.company, required_skills: null, keywords: null }
        }
      } else {
        // Step 2: legacy fallback — treat the param as a jobs.id deep link.
        const jobRes = await supabase
          .from('jobs')
          .select('id, title, company, required_skills, keywords')
          .eq('id', param)
          .eq('user_id', user.id)
          .maybeSingle()
        if (jobRes.data) {
          resolvedJob = jobRes.data as Job
          dataJobId = (jobRes.data as Job).id
          const appRes = await supabase
            .from('applications')
            .select('id, status, company, role, applied_date, job_id')
            .eq('job_id', param)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          resolvedApplication = (appRes.data as AppRow | null) ?? null
        }
      }

      // Step 3: neither an application nor a job resolved.
      if (!resolvedJob) {
        setPageError('Job not found or you do not have access.')
        setPageLoading(false)
        return
      }

      // Load documents + ats (keyed by job_id) and the profile. Skip the
      // job_id-keyed queries for manual targets so they resolve empty.
      let docs: DocRow[] = []
      let ats: AtsRow | null = null
      let profileRes: { data: { extension_token: string | null } | null }

      if (dataJobId) {
        const [docsRes, atsRes, pRes] = await Promise.all([
          supabase
            .from('documents')
            .select('id, type, content, created_at')
            .eq('job_id', dataJobId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('ats_scores')
            .select('id, overall_score')
            .eq('job_id', dataJobId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('extension_token')
            .eq('id', user.id)
            .single(),
        ])
        docs = (docsRes.data ?? []) as DocRow[]
        ats = (atsRes.data as AtsRow | null) ?? null
        profileRes = pRes as { data: { extension_token: string | null } | null }
      } else {
        profileRes = await supabase
          .from('profiles')
          .select('extension_token')
          .eq('id', user.id)
          .single() as { data: { extension_token: string | null } | null }
      }

      setJob(resolvedJob)
      setResumeDoc(docs.find(d => d.type === 'tailored_resume') ?? null)
      setCoverDoc(docs.find(d => d.type === 'cover_letter') ?? null)
      setAtsScore(ats)
      setApplication(resolvedApplication)
      setExtensionInstalled(!!profileRes.data?.extension_token)

      if (resolvedApplication?.id) {
        const qRes = await fetch(`/api/answer-question?applicationId=${resolvedApplication.id}`)
        if (qRes.ok) {
          const qJson = await qRes.json()
          setQuestions(
            ((qJson.questions ?? []) as Omit<QuestionRow, 'localAnswer'>[]).map(q => ({
              ...q,
              localAnswer: q.user_edited_answer ?? q.generated_answer,
            }))
          )
        }
      }

      setPageLoading(false)
    }
    void load()
  }, [jobId, supabase, router])

  // --- Generate answer ---------------------------------------------------

  async function handleGenerateAnswer() {
    if (!questionInput.trim() || !job) return
    if (!application?.id) {
      setGenerateError('Log this application in the tracker first to generate answers.')
      return
    }
    setGeneratingAnswer(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/answer-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, applicationId: application.id, question: questionInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setGenerateError(json.error ?? 'Failed to generate answer.'); return }
      const newRow = json.question as Omit<QuestionRow, 'localAnswer'>
      setQuestions(prev => [...prev, { ...newRow, localAnswer: newRow.generated_answer }])
      setQuestionInput('')
    } catch {
      setGenerateError('Network error. Please try again.')
    } finally {
      setGeneratingAnswer(false)
    }
  }

  // --- Auto-save answer edits --------------------------------------------

  function handleAnswerChange(id: string, value: string) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, localAnswer: value } : q))
    const existing = debounceRefs.current.get(id)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => { void saveAnswer(id, value) }, 500)
    debounceRefs.current.set(id, t)
  }

  async function saveAnswer(id: string, value: string) {
    try {
      const res = await fetch(`/api/answer-question/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_edited_answer: value }),
      })
      if (res.ok) {
        setSavedMap(prev => ({ ...prev, [id]: true }))
        setTimeout(() => setSavedMap(prev => ({ ...prev, [id]: false })), 2000)
      }
    } catch {}
  }

  async function copyAnswer(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedAnswers(prev => ({ ...prev, [id]: true }))
    setTimeout(() => setCopiedAnswers(prev => ({ ...prev, [id]: false })), 2000)
  }

  async function copyDoc(type: 'resume' | 'cover', content: string) {
    await navigator.clipboard.writeText(content)
    if (type === 'resume') {
      setCopiedResume(true); setTimeout(() => setCopiedResume(false), 2000)
    } else {
      setCopiedCover(true); setTimeout(() => setCopiedCover(false), 2000)
    }
  }

  // --- Mark as Applied ---------------------------------------------------

  async function handleMarkApplied() {
    if (!job) return
    setMarkingApplied(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      if (application?.id) {
        const res = await fetch(`/api/applications/${application.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'applied', applied_date: today }),
        })
        if (res.ok) {
          setApplication(prev => prev ? { ...prev, status: 'applied', applied_date: today } : prev)
        }
      } else {
        // No existing application (legacy job-linked deep link). Only send
        // job_id when the resolved target has a real job id, so we never POST
        // an application id as a job_id.
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: job.company,
            role: job.title,
            status: 'applied',
            ...(job.id ? { job_id: job.id } : {}),
            applied_date: today,
          }),
        })
        if (res.ok) {
          const json = await res.json()
          setApplication(json.application as AppRow)
        }
      }
    } catch {}
    finally { setMarkingApplied(false) }
  }

  // --- Shared styles -----------------------------------------------------

  const card: React.CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    padding: '20px 24px',
    marginBottom: '16px',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '14px',
  }

  const smallBtn: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '5px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textDecoration: 'none',
  }

  const primaryBtn: React.CSSProperties = {
    padding: '9px 20px',
    background: 'var(--gold-dim)',
    color: 'var(--gold)',
    border: '1px solid var(--gold-border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '13px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    boxSizing: 'border-box',
  }

  const kitCard: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  }

  // --- Loading / error states --------------------------------------------

  if (pageLoading) {
    return (
      <div className="dashboard-page">
        <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SkeletonLoader width={120} height={12} />
          <SkeletonLoader width={380} height={26} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonLoader height={140} />
          <SkeletonLoader height={140} />
          <SkeletonLoader height={200} />
        </div>
      </div>
    )
  }

  if (pageError || !job) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: '14px', color: '#ef4444', marginBottom: '16px' }}>
          {pageError ?? 'Job not found.'}
        </div>
        <Link href="/tracker" style={smallBtn}><ArrowIcon direction="left" /> Back to tracker</Link>
      </div>
    )
  }

  return (
    <div className="fade-in dashboard-page">

      {/* -- Header ---------------------------------------------------------- */}
      <div style={{ marginBottom: '28px' }}>
        <Link href="/tracker" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', display: 'inline-block', marginBottom: '10px' }}>
          <ArrowIcon direction="left" /> Back to tracker
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
            {job.title} at {job.company}
          </h1>
          {application && (
            <span style={{
              background: STATUS_COLOR[application.status],
              color: STATUS_TEXT[application.status],
              borderRadius: 'var(--radius-sm)',
              padding: '3px 8px',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              flexShrink: 0,
            }}>
              {STATUS_LABEL[application.status]}
            </span>
          )}
        </div>
      </div>

      {/* -- Application Kit ------------------------------------------------- */}
      <div style={card}>
        <div style={sectionLabel}>Application Kit</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>

          {/* Tailored Resume */}
          <div style={kitCard}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Tailored Resume</div>
            {resumeDoc ? (
              <>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  maxHeight: '72px',
                }}>
                  {resumeDoc.content.slice(0, 200)}{resumeDoc.content.length > 200 ? '…' : ''}
                </div>
                <div>
                  <button type="button" onClick={() => copyDoc('resume', resumeDoc.content)} style={smallBtn}>
                    {copiedResume ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: 'var(--muted)', flex: 1 }}>No tailored resume yet.</div>
                <div>
                  <Link href={`/tailor?jobId=${jobId}`} style={smallBtn}>Tailor resume <ArrowIcon /></Link>
                </div>
              </>
            )}
          </div>

          {/* Cover Letter */}
          <div style={kitCard}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Cover Letter</div>
            {coverDoc ? (
              <>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  maxHeight: '72px',
                }}>
                  {coverDoc.content.slice(0, 200)}{coverDoc.content.length > 200 ? '…' : ''}
                </div>
                <div>
                  <button type="button" onClick={() => copyDoc('cover', coverDoc.content)} style={smallBtn}>
                    {copiedCover ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: 'var(--muted)', flex: 1 }}>No cover letter yet.</div>
                <div>
                  <Link href={`/tailor?jobId=${jobId}`} style={smallBtn}>Generate <ArrowIcon /></Link>
                </div>
              </>
            )}
          </div>

          {/* ATS Score */}
          <div style={kitCard}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>ATS Score</div>
            {atsScore ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScoreBadge score={atsScore.overall_score} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Latest score</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: 'var(--muted)', flex: 1 }}>No ATS score yet.</div>
                <div>
                  <Link href={`/tailor?jobId=${jobId}`} style={smallBtn}>Check score <ArrowIcon /></Link>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* -- Question Answerer ------------------------------------------------ */}
      <div style={card}>
        <div style={sectionLabel}>Application Questions</div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
            Paste an application question here
          </label>
          <textarea
            value={questionInput}
            onChange={e => setQuestionInput(e.target.value)}
            placeholder="e.g. Why do you want to work at this company?"
            rows={3}
            style={textareaStyle}
          />
        </div>

        {generateError && (
          <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>{generateError}</div>
        )}

        <button
          type="button"
          onClick={handleGenerateAnswer}
          disabled={generatingAnswer || !questionInput.trim()}
          style={{ ...primaryBtn, opacity: generatingAnswer || !questionInput.trim() ? 0.6 : 1 }}
        >
          {generatingAnswer && <Spinner size="sm" />}
          Generate answer
        </button>

        {questions.length > 0 && (
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '0' }}>
            {questions.map(q => (
              <div key={q.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>
                  {q.question}
                </div>
                <textarea
                  value={q.localAnswer}
                  onChange={e => handleAnswerChange(q.id, e.target.value)}
                  rows={5}
                  style={textareaStyle}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => copyAnswer(q.id, q.localAnswer)}
                    style={smallBtn}
                  >
                    {copiedAnswers[q.id] ? 'Copied!' : 'Copy'}
                  </button>
                  {savedMap[q.id] && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Saved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- Auto-fill ----------------------------------------------------------- */}
      <div style={card}>
        <div style={sectionLabel}>Auto-fill</div>

        {extensionInstalled ? (
          <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.7 }}>
            Click the <strong>Vantage icon</strong> in your toolbar while you have the application form open.{' '}
            <Link href="/profile#extension-token" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px' }}>
              Manage connection code <ArrowIcon />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.7 }}>
              Install the Vantage extension to auto-fill application forms with one click.
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noreferrer"
                style={primaryBtn}
              >
                Install extension - 30 seconds
              </a>
              <Link href="/profile#extension-token" style={{ ...smallBtn, fontSize: '13px' }}>
                Already installed? Get your connection code <ArrowIcon />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* -- Submit Checklist ------------------------------------------------ */}
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={sectionLabel}>Submit Checklist</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          {CHECKLIST_ITEMS.map(item => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checklist[item.key]}
                onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              <span style={{ fontSize: '14px', color: checklist[item.key] ? 'var(--text)' : 'var(--muted)' }}>
                {item.label}
              </span>
            </label>
          ))}
        </div>

        {allChecked && (
          <button
            type="button"
            onClick={handleMarkApplied}
            disabled={markingApplied || application?.status === 'applied'}
            style={{
              ...primaryBtn,
              opacity: markingApplied || application?.status === 'applied' ? 0.7 : 1,
              cursor: application?.status === 'applied' ? 'default' : 'pointer',
            }}
          >
            {markingApplied && <Spinner size="sm" />}
            {application?.status === 'applied' ? 'Applied ✓' : 'Mark as Applied'}
          </button>
        )}
      </div>

    </div>
  )
}
