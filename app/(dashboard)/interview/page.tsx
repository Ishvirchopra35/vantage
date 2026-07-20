"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { rateLimitMessage } from '@/lib/rateLimitMessage'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/ui/Spinner'
import SkeletonLoader from '@/components/ui/SkeletonLoader'
import CustomSelect from '@/components/CustomSelect'
import ArrowIcon from '@/components/ui/ArrowIcon'
import PageHeader from '@/components/ui/PageHeader'
import { sessionProgress } from '@/lib/interviewProgress'
import ErrorNotice from '@/components/ui/ErrorNotice'
import { recordFeatureSuccess } from '@/components/FeatureFeedbackNudge'

// --- Types --------------------------------------------------------------------

interface InterviewQuestions {
  behavioral_questions: string[]
  technical_questions: string[]
  role_specific_questions: string[]
  tips: string[]
  _meta?: { title: string; company: string }
}

interface Assessment {
  score: number
  content_score: number
  delivery_score: number
  strengths: string[]
  improvements: string[]
  filler_words_detected: string[]
  better_answer_hint: string
}

interface InterviewSession {
  id: string
  job_id: string | null
  questions: InterviewQuestions | null
  practice_answers: Record<string, unknown>
  feedback: Record<string, Assessment>
  created_at: string
}

type Tab = 'behavioral' | 'technical' | 'role'
type AnswerMode = 'voice' | 'type'

// A selectable tracker entry. Manual tracker rows have no job_id - those start
// a session via the title/company payload instead of jobId.
interface TrackerJob {
  key: string
  jobId: string | null
  title: string
  company: string
}

// --- Styles -------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '8px',
  background: 'var(--card-raised)',
  color: 'var(--text)',
  border: '1px solid var(--border-subtle)',
  fontSize: '13px',
  outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '10px 20px',
  fontFamily: 'var(--font-display)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap' as const,
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '8px 16px',
  fontSize: '13px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap' as const,
}

// Map a session's practice progress to a status-badge pill. Complete reuses the
// green offer palette, in-progress the gold applied palette, and not-started a
// muted neutral treatment consistent with the design system.
function progressBadge(assessed: number, total: number): {
  label: string
  className: string
  style?: React.CSSProperties
} {
  switch (sessionProgress(assessed, total)) {
    case 'complete':
      return { label: 'Complete', className: 'status-badge status-offer' }
    case 'in_progress':
      return { label: 'In progress', className: 'status-badge status-applied' }
    default:
      return {
        label: 'Not started',
        className: 'status-badge',
        style: { color: 'var(--muted)', borderColor: 'var(--border)' },
      }
  }
}

// --- Page ---------------------------------------------------------------------

export default function InterviewPage() {
  const supabase = useMemo(() => createClient(), [])

  const [sessions, setSessions] = useState<InterviewSession[]>([])
  const [jobsList, setJobsList] = useState<TrackerJob[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [useManual, setUseManual] = useState(false)
  const [manualJob, setManualJob] = useState({ title: '', company: '', description: '' })
  const [tab, setTab] = useState<Tab>('behavioral')
  const [error, setError] = useState<string | null>(null)

  // voice recognition state - SpeechRecognition is not in TS lib, cast via unknown
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<unknown>(null)
  const currentQuestionKeyRef = useRef<string | null>(null)
  const [recordingQuestionKey, setRecordingQuestionKey] = useState<string | null>(null)
  const [recordingMap, setRecordingMap] = useState<Record<string, { interim: string; final: string }>>({})

  const [localFeedback, setLocalFeedback] = useState<Record<string, Assessment>>({})
  const [typedAnswers, setTypedAnswers] = useState<Record<string, string>>({})
  // One answer method for the whole session, not per question - set via the
  // toolbar control above the cards.
  const [answerMode, setAnswerMode] = useState<AnswerMode>('voice')
  const [assessingMap, setAssessingMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      interface AppRow {
        id: string
        job_id: string | null
        role: string
        company: string
      }
      // No embedded jobs(...) join here: it errors silently when PostgREST
      // can't resolve the relationship, and it drops manual tracker rows
      // (job_id is null). Fetch apps, then enrich from jobs separately.
      const [{ data: sessionsData }, appsRes] = await Promise.all([
        supabase
          .from('interview_sessions')
          .select('id, job_id, questions, practice_answers, feedback, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('applications')
          .select('id, job_id, role, company')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ])
      setSessions((sessionsData ?? []) as InterviewSession[])

      if (appsRes.error) {
        console.error('[interview] failed to load tracker:', appsRes.error)
        setError('We could not load your applications. Please try again.')
        setJobsList([])
        setLoading(false)
        return
      }

      const appRows = (appsRes.data ?? []) as AppRow[]

      // Prefer the parsed job's title/company when a job record exists
      const jobIds = [...new Set(appRows.map(a => a.job_id).filter(Boolean))] as string[]
      let jobMap = new Map<string, { title: string; company: string }>()
      if (jobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('jobs')
          .select('id, title, company')
          .in('id', jobIds)
        jobMap = new Map(
          ((jobRows ?? []) as { id: string; title: string; company: string }[])
            .map(j => [j.id, { title: j.title, company: j.company }])
        )
      }

      const seen = new Set<string>()
      const options: TrackerJob[] = []
      for (const a of appRows) {
        const dedupeKey = a.job_id ?? `${a.company.toLowerCase()}|${a.role.toLowerCase()}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        const job = a.job_id ? jobMap.get(a.job_id) : undefined
        options.push({
          key: a.job_id ?? `app:${a.id}`,
          jobId: a.job_id,
          title: job?.title || a.role,
          company: job?.company || a.company,
        })
      }
      setJobsList(options)
      setLoading(false)
    }
    void load()
  }, [supabase])

  function supportsSpeech() {
    return (
      typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    )
  }

  // Browsers without speech recognition can only type - default the session there.
  useEffect(() => {
    if (!supportsSpeech()) setAnswerMode('type')
  }, [])

  function speak(text: string) {
    if (typeof window === 'undefined') return
    try {
      const u = new SpeechSynthesisUtterance(text)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch { /* ignore */ }
  }

  function startRecording(questionKey: string) {
    if (!supportsSpeech()) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = recognitionRef.current as any
    if (existing) { try { existing.stop() } catch { /* ignore */ } }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog = new SpeechRec() as any
    recog.continuous = true
    recog.interimResults = true
    recog.lang = 'en-US'
    recognitionRef.current = recog
    currentQuestionKeyRef.current = questionKey
    setRecordingQuestionKey(questionKey)
    setRecordingMap(prev => ({ ...prev, [questionKey]: { interim: '', final: '' } }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (ev: any) => {
      let interim = ''
      let final = ''
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript
        else interim += ev.results[i][0].transcript
      }
      const key = currentQuestionKeyRef.current
      if (key) {
        setRecordingMap(prev => {
          const prev2 = prev[key] ?? { interim: '', final: '' }
          return { ...prev, [key]: { interim, final: prev2.final ? prev2.final + ' ' + final : final } }
        })
      }
    }
    recog.onerror = () => { setIsRecording(false); setRecordingQuestionKey(null) }
    recog.onend = () => { setIsRecording(false); setRecordingQuestionKey(null) }
    recog.start()
    setIsRecording(true)
  }

  function stopAndAssess(questionText: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog = recognitionRef.current as any
    if (recog) { try { recog.stop() } catch { /* ignore */ } }
    recognitionRef.current = null
    setIsRecording(false)
    const recorded = recordingMap[questionText] ?? { final: '', interim: '' }
    const answer = (recorded.final + ' ' + recorded.interim).trim() || recorded.final || recorded.interim || ''
    setRecordingQuestionKey(null)
    void submitAssessment(activeSession?.id, questionText, answer)
  }

  async function submitAssessment(sessionId: string | undefined, question: string, answer: string) {
    if (!sessionId) return
    setAssessingMap(prev => ({ ...prev, [question]: true }))
    try {
      const res = await fetch('/api/interview-prep/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, question, answer }),
      })
      const json = await res.json() as { assessment?: Assessment; error?: string; retryAfter?: number }
      if (res.status === 429) {
        setError(json.error || rateLimitMessage(json.retryAfter))
        return
      }
      if (!res.ok || !json.assessment) {
        setError(json.error ?? 'Assessment failed')
        return
      }
      setLocalFeedback(prev => ({ ...prev, [question]: json.assessment! }))
      setSessions(prev =>
        prev.map(s => s.id === sessionId
          ? { ...s, feedback: { ...(s.feedback ?? {}), [question]: json.assessment! } }
          : s
        )
      )
      setTypedAnswers(prev => ({ ...prev, [question]: '' }))
    } catch (e) {
      console.error('[interview] assessment request failed:', e)
      setError('Network error. Please try again.')
    } finally {
      setAssessingMap(prev => ({ ...prev, [question]: false }))
    }
  }

  async function handleStartSession() {
    if (useManual) {
      if (!manualJob.title.trim() || !manualJob.company.trim()) return
    } else {
      if (!selectedJobId) return
    }
    setError(null)
    setCreating(true)
    const selectedEntry = jobsList.find(j => j.key === selectedJobId)
    if (!useManual && !selectedEntry) {
      setCreating(false)
      return
    }
    // Tracker rows without a linked job record start via title/company,
    // same as the manual path - the API accepts either shape
    const payload = useManual
      ? { title: manualJob.title.trim(), company: manualJob.company.trim(), description: manualJob.description.trim() || undefined }
      : selectedEntry!.jobId
        ? { jobId: selectedEntry!.jobId }
        : { title: selectedEntry!.title, company: selectedEntry!.company }
    try {
      const res = await fetch('/api/interview-prep/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { session?: InterviewSession; error?: string; retryAfter?: number }
      if (res.status === 429) {
        setError(json.error || rateLimitMessage(json.retryAfter))
        return
      }
      if (!res.ok || !json.session) {
        setError(json.error ?? 'Failed to start session')
        return
      }
      setSessions(prev => [json.session!, ...prev])
      setActiveSession(json.session!)
      recordFeatureSuccess()
    } catch (e) {
      console.error('[interview] start session request failed:', e)
      setError('Network error. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SkeletonLoader width={220} height={26} />
          <SkeletonLoader width={340} height={14} />
        </div>
        <SkeletonLoader height={170} />
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={64} />
          ))}
        </div>
      </div>
    )
  }

  // -- Landing -----------------------------------------------------------------

  if (!activeSession) {
    return (
      <div className="fade-in dashboard-page">
        <PageHeader
          title="Interview practice"
          subtitle="Generate tailored questions and get AI feedback on your answers."
        />

        {/* Start session card */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', padding: '24px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>Start a new session</div>

          {!useManual ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <CustomSelect
                value={selectedJobId}
                onChange={setSelectedJobId}
                placeholder={jobsList.length > 0 ? 'Select a job from your tracker…' : 'No applications in your tracker yet'}
                options={jobsList.map(j => ({ value: j.key, label: `${j.title} - ${j.company}` }))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => void handleStartSession()}
                disabled={!selectedJobId || creating}
                className="btn-gold-hover"
                style={{ ...primaryBtn, opacity: !selectedJobId || creating ? 0.6 : 1 }}
              >
                {creating && <Spinner size="sm" />}
                {creating ? 'Generating…' : 'Start new session'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="rsp-grid-2" style={{ gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '5px' }}>Job Title</label>
                  <input
                    type="text"
                    value={manualJob.title}
                    onChange={e => setManualJob(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Software Engineer"
                    style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '5px' }}>Company</label>
                  <input
                    type="text"
                    value={manualJob.company}
                    onChange={e => setManualJob(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="e.g. Stripe"
                    style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '5px' }}>Job Description (optional)</label>
                <textarea
                  value={manualJob.description}
                  onChange={e => setManualJob(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Paste the job description here…"
                  rows={4}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => void handleStartSession()}
                  disabled={!manualJob.title.trim() || !manualJob.company.trim() || creating}
                  className="btn-gold-hover"
                  style={{ ...primaryBtn, opacity: !manualJob.title.trim() || !manualJob.company.trim() || creating ? 0.6 : 1 }}
                >
                  {creating && <Spinner size="sm" />}
                  {creating ? 'Generating…' : 'Start new session'}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setUseManual(v => !v); setSelectedJobId(''); setManualJob({ title: '', company: '', description: '' }) }}
            style={{ marginTop: '10px', background: 'none', border: 'none', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
          >
            {useManual ? <><ArrowIcon direction="left" /> Select from tracker instead</> : "Don't see your job? Enter it manually"}
          </button>

          {error && <ErrorNotice message={error} style={{ marginTop: '14px' }} />}
        </div>

        {/* How practice works */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            {
              title: 'Real questions',
              description: 'Generated from the job’s actual requirements.',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
            },
            {
              title: 'Answer out loud',
              description: 'Speak your answer or type it - your call.',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>,
            },
            {
              title: 'Scored feedback',
              description: 'Every answer graded, with what to fix next.',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
            },
          ].map(tip => (
            <div key={tip.title} style={{ background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', padding: '16px' }}>
              <div style={{ width: '28px', height: '28px', background: 'var(--card-raised)', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', color: 'var(--muted)', marginBottom: '10px' }}>
                {tip.icon}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{tip.title}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>{tip.description}</div>
            </div>
          ))}
        </div>

        {/* Past sessions */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', padding: '24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>Past sessions</div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ width: '36px', height: '36px', margin: '0 auto 14px', background: 'var(--card-raised)', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                No sessions yet
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)' }}>
                Start a session above to practice with AI feedback
              </div>
            </div>
          ) : (
            <div>
              {sessions.map(s => {
                const job = s.job_id ? jobsList.find(j => j.jobId === s.job_id) : undefined
                const meta = !s.job_id ? s.questions?._meta : null
                const displayCompany = job?.company ?? meta?.company ?? '-'
                const displayTitle = job?.title ?? meta?.title ?? null
                const primaryLine = displayTitle ?? displayCompany
                const qs = s.questions
                const total = (qs?.behavioral_questions?.length ?? 0) +
                  (qs?.technical_questions?.length ?? 0) +
                  (qs?.role_specific_questions?.length ?? 0)
                const practiced = Object.keys(s.feedback ?? {}).length
                const badge = progressBadge(practiced, total)
                const resume = () => { setActiveSession(s); setLocalFeedback(s.feedback ?? {}); setError(null) }
                return (
                  <div
                    key={s.id}
                    className="dash-row"
                    onClick={resume}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {primaryLine}
                        {displayTitle && displayCompany !== '-' && (
                          <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {displayCompany}</span>
                        )}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted)' }}>
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span className={badge.className} style={badge.style}>{badge.label}</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); resume() }}
                        style={{ ...ghostBtn, padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // -- Practice session ---------------------------------------------------------

  const qs = activeSession.questions ?? {
    behavioral_questions: [],
    technical_questions: [],
    role_specific_questions: [],
    tips: [],
  }

  const allFeedback = { ...(activeSession.feedback ?? {}), ...localFeedback }
  const totalQuestions =
    (qs.behavioral_questions?.length ?? 0) +
    (qs.technical_questions?.length ?? 0) +
    (qs.role_specific_questions?.length ?? 0)
  const assessedCount = Object.keys(allFeedback).length

  const currentQuestions =
    tab === 'behavioral' ? qs.behavioral_questions :
    tab === 'technical' ? qs.technical_questions :
    qs.role_specific_questions

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'behavioral', label: 'Behavioral', count: qs.behavioral_questions?.length ?? 0 },
    { key: 'technical', label: 'Technical', count: qs.technical_questions?.length ?? 0 },
    { key: 'role', label: 'Role-specific', count: qs.role_specific_questions?.length ?? 0 },
  ]

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: '4px' }}>Practice session</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)' }}>
            {assessedCount} of {totalQuestions} questions assessed
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setActiveSession(null); setLocalFeedback({}); setError(null) }}
          style={ghostBtn}
        >
          <ArrowIcon direction="left" /> Back to sessions
        </button>
      </div>

      {error && <ErrorNotice message={error} style={{ marginBottom: '16px' }} onDismiss={() => setError(null)} />}

      {!supportsSpeech() && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'var(--card)', fontSize: '12px', color: 'var(--muted)' }}>
          Speech recognition is not available in this browser. Use "Type" mode to answer questions.
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${totalQuestions > 0 ? (assessedCount / totalQuestions) * 100 : 0}%`, height: '100%', background: 'var(--text)', borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Toolbar: category tabs (left) + one answer method for every card (right) */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: tab === t.key ? 700 : 400,
                background: 'var(--card-raised)',
                color: tab === t.key ? 'var(--text)' : 'var(--muted)',
                boxShadow: tab === t.key ? 'inset 0 0 0 1px rgba(255,255,255,0.16)' : 'none',
              }}
            >
              {t.label} <span style={{ opacity: 0.7 }}>({t.count})</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="ds-section-label">Answer with</span>
          <div
            role="group"
            aria-label="Answer method"
            style={{ display: 'inline-flex', gap: '2px', padding: '2px', background: 'var(--card-raised)', border: 'none', borderRadius: '20px' }}
          >
            {(['voice', 'type'] as AnswerMode[]).map(m => {
              const active = answerMode === m
              const disabled = m === 'voice' && !supportsSpeech()
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAnswerMode(m)}
                  disabled={disabled}
                  aria-pressed={active}
                  title={disabled ? 'Voice is not available in this browser' : undefined}
                  style={{
                    fontSize: '12px',
                    fontWeight: active ? 600 : 500,
                    padding: '5px 16px',
                    borderRadius: '18px',
                    border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--bg)' : 'var(--muted)',
                    opacity: disabled ? 0.4 : 1,
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  {m === 'voice' ? 'Voice' : 'Type'}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Question cards */}
      {(currentQuestions ?? []).map((q: string) => {
        const assessment = allFeedback[q]
        const mode: AnswerMode = supportsSpeech() ? answerMode : 'type'
        const isThisRecording = isRecording && recordingQuestionKey === q
        const isAssessing = !!assessingMap[q]
        const recorded = recordingMap[q] ?? { final: '', interim: '' }

        return (
          <div
            key={q}
            className="ds-card"
            style={{ padding: '24px', marginBottom: '20px' }}
          >
            {/* Question row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: assessment || isThisRecording || (mode === 'type') ? '20px' : '0' }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: 1.6, color: 'var(--text)', flex: 1 }}>{q}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
                {/* Hear question */}
                <button
                  type="button"
                  onClick={() => speak(q)}
                  style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--card-raised)', border: 'none', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer' }}
                >
                  Hear question
                </button>

                {/* Action buttons */}
                {mode === 'voice' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => startRecording(q)}
                        disabled={isThisRecording || isAssessing}
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: '8px', padding: '8px 14px', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, cursor: isThisRecording || isAssessing ? 'not-allowed' : 'pointer', opacity: isThisRecording || isAssessing ? 0.5 : 1 }}
                      >
                        Start answering
                      </button>
                      <button
                        type="button"
                        onClick={() => stopAndAssess(q)}
                        disabled={!isThisRecording || isAssessing}
                        style={{ background: 'var(--card-raised)', border: 'none', color: 'var(--text)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: !isThisRecording || isAssessing ? 'not-allowed' : 'pointer', opacity: !isThisRecording || isAssessing ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {isAssessing && <Spinner size="sm" />}
                        {isAssessing ? 'Assessing…' : 'Stop + Assess'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void submitAssessment(activeSession.id, q, "I don't know")}
                      disabled={isAssessing}
                      style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                    >
                      I don't know
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submitAssessment(activeSession.id, q, typedAnswers[q] ?? '')}
                    disabled={!typedAnswers[q]?.trim() || isAssessing}
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: '8px', padding: '8px 14px', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, cursor: !typedAnswers[q]?.trim() || isAssessing ? 'not-allowed' : 'pointer', opacity: !typedAnswers[q]?.trim() || isAssessing ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isAssessing && <Spinner size="sm" />}
                    {isAssessing ? 'Assessing…' : 'Submit'}
                  </button>
                )}
              </div>
            </div>

            {/* Typed textarea */}
            {mode === 'type' && (
              <textarea
                placeholder="Type your answer here…"
                value={typedAnswers[q] ?? ''}
                onChange={e => setTypedAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                rows={4}
                style={{ width: '100%', background: 'var(--card-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', minHeight: '80px', resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.6, boxSizing: 'border-box', outline: 'none' }}
              />
            )}

            {/* Voice recording indicator */}
            {mode === 'voice' && (isThisRecording || recorded.final || recorded.interim) && (
              <div style={{ marginTop: '12px' }}>
                {isThisRecording && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Recording…</span>
                  </div>
                )}
                {(recorded.final || recorded.interim) && (
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                    {recorded.final}
                    {recorded.interim && <em style={{ opacity: 0.6 }}> {recorded.interim}</em>}
                  </div>
                )}
              </div>
            )}

            {/* Assessment result */}
            {assessment && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--text)', background: 'var(--card-raised)', border: 'none', borderRadius: '20px', padding: '4px 12px' }}>
                    Score <span style={{ fontSize: '14px' }}>{assessment.score}/10</span>
                  </div>
                  {assessment.content_score !== undefined && (
                    <>
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                        Content: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{assessment.content_score}/10</span>
                      </div>
                    </>
                  )}
                  {assessment.delivery_score !== undefined && (
                    <>
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                        Delivery: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{assessment.delivery_score}/10</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="rsp-grid-2" style={{ gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, color: '#4ade80', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Strengths</div>
                    {(assessment.strengths ?? []).length === 0 ? (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)' }}>-</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        {assessment.strengths.map((s, i) => (
                          <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text)', marginBottom: '4px', lineHeight: 1.5 }}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Improve</div>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      {(assessment.improvements ?? []).map((s, i) => (
                        <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text)', marginBottom: '4px', lineHeight: 1.5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {assessment.filler_words_detected?.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {assessment.filler_words_detected.map((f, i) => (
                      <span key={i} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none' }}>{f}</span>
                    ))}
                  </div>
                )}

                {assessment.better_answer_hint && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--card-raised)', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                    {assessment.better_answer_hint}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Prep tips */}
      {(qs.tips ?? []).length > 0 && (
        <div className="ds-card" style={{ marginTop: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>Prep tips</div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {(qs.tips ?? []).map((t, i) => (
              <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginBottom: '6px', lineHeight: 1.6 }}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  )
}
