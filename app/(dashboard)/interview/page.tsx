"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterviewQuestions {
  behavioral_questions: string[]
  technical_questions: string[]
  role_specific_questions: string[]
  tips: string[]
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '8px',
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  fontSize: '13px',
  outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  borderRadius: '10px',
  padding: '10px 18px',
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const supabase = useMemo(() => createClient(), [])

  const [sessions, setSessions] = useState<InterviewSession[]>([])
  const [jobsList, setJobsList] = useState<{ id: string; title: string; company: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [tab, setTab] = useState<Tab>('behavioral')
  const [error, setError] = useState<string | null>(null)

  // voice recognition state — SpeechRecognition is not in TS lib, cast via unknown
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<unknown>(null)
  const currentQuestionKeyRef = useRef<string | null>(null)
  const [recordingQuestionKey, setRecordingQuestionKey] = useState<string | null>(null)
  const [recordingMap, setRecordingMap] = useState<Record<string, { interim: string; final: string }>>({})

  const [localFeedback, setLocalFeedback] = useState<Record<string, Assessment>>({})
  const [typedAnswers, setTypedAnswers] = useState<Record<string, string>>({})
  const [answerMode, setAnswerMode] = useState<Record<string, AnswerMode>>({})
  const [assessingMap, setAssessingMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: sessionsData }, { data: jobs }] = await Promise.all([
        supabase
          .from('interview_sessions')
          .select('id, job_id, questions, practice_answers, feedback, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('id, title, company, applications!inner(id)')
          .order('created_at', { ascending: false }),
      ])
      setSessions((sessionsData ?? []) as InterviewSession[])
      setJobsList((jobs ?? []).map(({ id, title, company }) => ({ id, title, company })))
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
      const json = await res.json() as { assessment?: Assessment; error?: string }
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
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setAssessingMap(prev => ({ ...prev, [question]: false }))
    }
  }

  async function handleStartSession() {
    if (!selectedJobId) return
    setError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/interview-prep/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJobId }),
      })
      const json = await res.json() as { session?: InterviewSession; error?: string }
      if (!res.ok || !json.session) {
        setError(json.error ?? 'Failed to start session')
        return
      }
      setSessions(prev => [json.session!, ...prev])
      setActiveSession(json.session!)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Landing ─────────────────────────────────────────────────────────────────

  if (!activeSession) {
    return (
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Interview Practice</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Generate tailored questions and get AI feedback on your answers</div>
        </div>

        {/* Start session card */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '14px' }}>Start a new session</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">Select a job…</option>
              {jobsList.map(j => (
                <option key={j.id} value={j.id}>{j.title} — {j.company}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleStartSession()}
              disabled={!selectedJobId || creating}
              style={{ ...primaryBtn, opacity: !selectedJobId || creating ? 0.6 : 1 }}
            >
              {creating && <Spinner size="sm" />}
              {creating ? 'Generating…' : 'Start new session'}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>

        {/* Past sessions */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>Past sessions</div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '13px', color: 'var(--muted)' }}>
              No sessions yet. Start one above to practice.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Company', 'Date', 'Progress', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0 12px 10px 0', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const job = jobsList.find(j => j.id === s.job_id)
                  const qs = s.questions
                  const total = (qs?.behavioral_questions?.length ?? 0) +
                    (qs?.technical_questions?.length ?? 0) +
                    (qs?.role_specific_questions?.length ?? 0)
                  const practiced = Object.keys(s.feedback ?? {}).length
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--text)', fontWeight: 500 }}>
                        {job?.company ?? '—'}
                        {job && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {job.title}</span>}
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--muted)' }}>
                        {practiced} / {total} assessed
                      </td>
                      <td style={{ padding: '12px 0' }}>
                        <button
                          type="button"
                          onClick={() => { setActiveSession(s); setLocalFeedback(s.feedback ?? {}); setError(null) }}
                          style={{ ...ghostBtn, padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                        >
                          Resume
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ── Practice session ─────────────────────────────────────────────────────────

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
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Practice session</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {assessedCount} of {totalQuestions} questions assessed
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setActiveSession(null); setLocalFeedback({}); setError(null) }}
          style={ghostBtn}
        >
          ← Back to sessions
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#ef4444' }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Dismiss</button>
        </div>
      )}

      {!supportsSpeech() && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'var(--card)', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--muted)' }}>
          Speech recognition is not available in this browser. Use "Type" mode to answer questions.
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${totalQuestions > 0 ? (assessedCount / totalQuestions) * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid',
              cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 400,
              background: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? 'var(--bg)' : 'var(--muted)',
              borderColor: tab === t.key ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {t.label} <span style={{ opacity: 0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* Question cards */}
      {(currentQuestions ?? []).map((q: string) => {
        const assessment = allFeedback[q]
        const mode: AnswerMode = answerMode[q] ?? (supportsSpeech() ? 'voice' : 'type')
        const isThisRecording = isRecording && recordingQuestionKey === q
        const isAssessing = !!assessingMap[q]
        const recorded = recordingMap[q] ?? { final: '', interim: '' }

        return (
          <div
            key={q}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '12px' }}
          >
            {/* Question row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: assessment || isThisRecording || (mode === 'type') ? '16px' : '0' }}>
              <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text)', flex: 1 }}>{q}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
                {/* Hear + mode toggle */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => speak(q)}
                    style={{ fontSize: '12px', color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer' }}
                  >
                    Hear question
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerMode(prev => ({ ...prev, [q]: 'voice' }))}
                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)', cursor: 'pointer', background: mode === 'voice' ? 'var(--accent)' : 'transparent', color: mode === 'voice' ? 'var(--bg)' : 'var(--muted)' }}
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerMode(prev => ({ ...prev, [q]: 'type' }))}
                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)', cursor: 'pointer', background: mode === 'type' ? 'var(--accent)' : 'transparent', color: mode === 'type' ? 'var(--bg)' : 'var(--muted)' }}
                  >
                    Type
                  </button>
                </div>

                {/* Action buttons */}
                {mode === 'voice' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => startRecording(q)}
                        disabled={isThisRecording || isAssessing}
                        style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: isThisRecording || isAssessing ? 'not-allowed' : 'pointer', opacity: isThisRecording || isAssessing ? 0.5 : 1 }}
                      >
                        Start answering
                      </button>
                      <button
                        type="button"
                        onClick={() => stopAndAssess(q)}
                        disabled={!isThisRecording || isAssessing}
                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: !isThisRecording || isAssessing ? 'not-allowed' : 'pointer', opacity: !isThisRecording || isAssessing ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {isAssessing && <Spinner size="sm" />}
                        {isAssessing ? 'Assessing…' : 'Stop + Assess'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void submitAssessment(activeSession.id, q, "I don't know")}
                      disabled={isAssessing}
                      style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      I don't know
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submitAssessment(activeSession.id, q, typedAnswers[q] ?? '')}
                    disabled={!typedAnswers[q]?.trim() || isAssessing}
                    style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: !typedAnswers[q]?.trim() || isAssessing ? 'not-allowed' : 'pointer', opacity: !typedAnswers[q]?.trim() || isAssessing ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', marginTop: '4px', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box', outline: 'none' }}
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
                  <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                    {recorded.final}
                    {recorded.interim && <em style={{ opacity: 0.6 }}> {recorded.interim}</em>}
                  </div>
                )}
              </div>
            )}

            {/* Assessment result */}
            {assessment && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                    Score <span style={{ color: 'var(--text)', fontWeight: 600 }}>{assessment.score}/10</span>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#4ade80', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Strengths</div>
                    {(assessment.strengths ?? []).length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>—</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        {assessment.strengths.map((s, i) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px', lineHeight: 1.5 }}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Improve</div>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      {(assessment.improvements ?? []).map((s, i) => (
                        <li key={i} style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px', lineHeight: 1.5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {assessment.filler_words_detected?.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {assessment.filler_words_detected.map((f, i) => (
                      <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{f}</span>
                    ))}
                  </div>
                )}

                {assessment.better_answer_hint && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
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
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginTop: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>Prep tips</div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {(qs.tips ?? []).map((t, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px', lineHeight: 1.6 }}>{t}</li>
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
