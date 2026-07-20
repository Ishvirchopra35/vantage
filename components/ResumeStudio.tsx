'use client'

// Resume Studio (experimental): a tailoring-focused editing playground.
// Start from an uploaded file, your base resume, or a resume you already
// tailored on the Tailor + ATS page - then edit it by chatting. Each
// instruction goes to the AI with the current HTML and the preview
// re-renders with the full updated resume. Download re-uses the same print
// pipeline as tailored resumes, so preview == PDF.
//
// The default tailoring flow stays on Tailor + ATS; this is where you
// fine-tune the result by hand. Editor state lives in the browser only
// (sessionStorage), never in the database.
import { useEffect, useRef, useState } from 'react'
import Spinner from '@/components/ui/Spinner'
import { createClient } from '@/lib/supabase/client'
import { RESUME_CSS } from '@/lib/resumeCss'
import ErrorNotice from '@/components/ui/ErrorNotice'

const STORAGE_KEY = 'vantage-resume-studio-html'
const MAX_FILE_BYTES = 5 * 1024 * 1024

interface EditTurn {
  instruction: string
  status: 'applied' | 'failed'
  note?: string
}

interface TailoredSource {
  documentId: string
  jobTitle: string
  company: string
  skillGaps: string[]
  keywords: string[]
}

export default function ResumeStudio(): React.ReactElement {
  const [html, setHtml] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'reading' | 'formatting' | 'editing' | 'downloading'>('idle')
  const [turns, setTurns] = useState<EditTurn[]>([])
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const turnsRef = useRef<HTMLDivElement>(null)

  // Tailoring-focused start sources: recent tailored resumes + the base resume.
  const [tailoredSources, setTailoredSources] = useState<TailoredSource[]>([])
  const [baseResumeHtml, setBaseResumeHtml] = useState<string | null>(null)
  const [sourcesLoading, setSourcesLoading] = useState(true)
  // Chips shown above the instruction box after seeding from a tailored doc.
  const [suggestionChips, setSuggestionChips] = useState<string[]>([])

  // Resume the previous session if the tab was refreshed.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) setHtml(saved)
    } catch {
      // sessionStorage unavailable - start clean.
    }
  }, [])

  // Load start sources: the user's recent tailored resumes (with job info
  // for labels and suggestion chips) and the base resume HTML.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadSources() {
      try {
        const [docsResult, profileResult] = await Promise.all([
          supabase
            .from('documents')
            .select('id, job_id, skill_gaps, created_at')
            .eq('type', 'tailored_resume')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('profiles')
            .select('resume_html')
            .limit(1)
            .single(),
        ])

        const docs = docsResult.data ?? []
        const jobIds = [...new Set(docs.map(d => d.job_id).filter(Boolean))]
        const { data: jobs } = jobIds.length
          ? await supabase
              .from('jobs')
              .select('id, title, company, keywords')
              .in('id', jobIds)
          : { data: [] }

        if (cancelled) return

        const jobById = new Map((jobs ?? []).map(j => [j.id, j]))
        // One entry per job (newest doc wins) keeps the picker readable.
        const seenJobs = new Set<string>()
        const sources: TailoredSource[] = []
        for (const doc of docs) {
          const job = doc.job_id ? jobById.get(doc.job_id) : undefined
          if (!job || seenJobs.has(job.id)) continue
          seenJobs.add(job.id)
          sources.push({
            documentId: doc.id,
            jobTitle: job.title ?? 'Untitled role',
            company: job.company ?? '',
            skillGaps: Array.isArray(doc.skill_gaps) ? doc.skill_gaps.slice(0, 4) : [],
            keywords: Array.isArray(job.keywords) ? job.keywords.slice(0, 4) : [],
          })
        }
        setTailoredSources(sources.slice(0, 5))

        const profileHtml = profileResult.data?.resume_html
        if (typeof profileHtml === 'string' && profileHtml.trim().startsWith('<')) {
          setBaseResumeHtml(profileHtml)
        }
      } catch {
        // Sources are a convenience - the upload path always works.
      } finally {
        if (!cancelled) setSourcesLoading(false)
      }
    }

    void loadSources()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    turnsRef.current?.scrollTo({ top: turnsRef.current.scrollHeight })
  }, [turns, phase])

  function saveHtml(next: string) {
    setHtml(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preview still works without persistence.
    }
  }

  function startOver() {
    setHtml(null)
    setTurns([])
    setInstruction('')
    setError(null)
    setSuggestionChips([])
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clean up.
    }
  }

  async function handleFile(file: File) {
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError('File must be under 5MB.')
      return
    }

    setPhase('reading')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const extractRes = await fetch('/api/resume-studio', { method: 'POST', body: formData })
      const extractJson = await extractRes.json()
      if (!extractRes.ok) {
        setError(extractJson.error ?? 'Could not read that file.')
        return
      }

      setPhase('formatting')
      const genRes = await fetch('/api/resume-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          text: extractJson.text,
          // Link annotations from the file - the AI re-attaches them so the
          // downloaded PDF keeps every hyperlink the original had.
          links: extractJson.links ?? [],
        }),
      })
      const genJson = await genRes.json()
      if (!genRes.ok) {
        setError(genJson.error ?? 'Could not format the resume.')
        return
      }

      setSuggestionChips([])
      saveHtml(genJson.html as string)
      setTurns([])
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPhase('idle')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Seed the editor with a resume tailored on the Tailor + ATS page. The
  // render endpoint swaps tailored bullets into the link-preserving base
  // resume HTML (AI only as fallback), so this is usually instant.
  async function startFromTailored(source: TailoredSource) {
    setError(null)
    setPhase('formatting')
    try {
      const res = await fetch('/api/tailor-resume/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: source.documentId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load that tailored resume.')
        return
      }
      const chips = [...new Set([...source.skillGaps, ...source.keywords])].slice(0, 6)
      setSuggestionChips(chips)
      saveHtml(json.html as string)
      setTurns([])
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPhase('idle')
    }
  }

  function startFromBase() {
    if (!baseResumeHtml) return
    setError(null)
    setSuggestionChips([])
    saveHtml(baseResumeHtml)
    setTurns([])
  }

  async function applyInstruction() {
    const text = instruction.trim()
    if (!text || !html || phase !== 'idle') return
    setError(null)
    setInstruction('')
    setPhase('editing')
    try {
      const res = await fetch('/api/resume-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', html, instruction: text }),
      })
      const json = await res.json()
      if (!res.ok) {
        setTurns(prev => [...prev, { instruction: text, status: 'failed', note: json.error }])
        return
      }
      saveHtml(json.html as string)
      setTurns(prev => [...prev, { instruction: text, status: 'applied' }])
    } catch {
      setTurns(prev => [...prev, { instruction: text, status: 'failed', note: 'Network error' }])
    } finally {
      setPhase('idle')
    }
  }

  async function downloadPdf() {
    if (!html || phase !== 'idle') return
    setError(null)
    setPhase('downloading')
    try {
      const res = await fetch('/api/resume-studio/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? 'Could not create the PDF.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'resume.pdf'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPhase('idle')
    }
  }

  const busy = phase !== 'idle'

  const card: React.CSSProperties = {
    background: 'var(--card)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
  }

  // ---- Upload state ----------------------------------------------------------

  if (!html) {
    const sourceCard: React.CSSProperties = {
      background: 'var(--card-raised)',
      borderRadius: 'var(--radius)',
      padding: '16px',
      textAlign: 'left',
      border: 'none',
      cursor: busy ? 'not-allowed' : 'pointer',
      opacity: busy ? 0.6 : 1,
      width: '100%',
      display: 'block',
    }

    return (
      <div style={{ ...card, padding: '40px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px', textAlign: 'center' }}>
            Pick a resume to fine-tune
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px', textAlign: 'center' }}>
            Tailoring happens on the Tailor + ATS page - this is where you polish
            the result by hand. Edits live only in this browser tab.
          </div>

          {/* Tailored resumes from the Tailor + ATS page */}
          {tailoredSources.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>
                Continue from a tailored resume
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tailoredSources.map(source => (
                  <button
                    key={source.documentId}
                    type="button"
                    disabled={busy}
                    onClick={() => void startFromTailored(source)}
                    style={sourceCard}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      {source.jobTitle}{source.company ? ` · ${source.company}` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      Tailored on Tailor + ATS - open it here to fine-tune
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Base resume + file upload */}
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>
            {tailoredSources.length > 0 ? 'Or start from' : 'Start from'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {baseResumeHtml && (
              <button type="button" disabled={busy} onClick={startFromBase} style={sourceCard}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Your base resume</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  The resume on your Profile page, opened instantly
                </div>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              style={sourceCard}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {busy && <Spinner size="sm" />}
                {phase === 'reading' ? 'Reading file…' : phase === 'formatting' ? 'Formatting resume…' : 'Upload a file'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                PDF or Word, up to 5MB. Read once, never stored - hyperlinks are kept.
              </div>
            </button>
          </div>

          {sourcesLoading && tailoredSources.length === 0 && !baseResumeHtml && (
            <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
              <Spinner size="sm" /> Looking for your tailored resumes…
            </div>
          )}
          {error && <ErrorNotice message={error} style={{ marginTop: '14px' }} />}
        </div>
      </div>
    )
  }

  // ---- Editing state ---------------------------------------------------------

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', minHeight: '640px' }}>
      {/* Left: instructions */}
      <div style={{ ...card, width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Edits
          </div>
          <button
            type="button"
            onClick={startOver}
            style={{ fontSize: '12px', color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Start over
          </button>
        </div>

        <div ref={turnsRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {turns.length === 0 && phase !== 'editing' ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              Tell the AI what to change, one instruction at a time. For example:
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <span>&ldquo;Cut the summary to two lines&rdquo;</span>
                <span>&ldquo;Reword my first job&rsquo;s bullets to emphasize leadership&rdquo;</span>
                <span>&ldquo;Move Projects above Experience&rdquo;</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {turns.map((turn, i) => (
                <div key={i}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      background: 'var(--card-raised)',
                      color: 'var(--text)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {turn.instruction}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '4px', color: turn.status === 'applied' ? 'var(--muted)' : '#ef4444' }}>
                    {turn.status === 'applied' ? 'Applied' : `Failed${turn.note ? `: ${turn.note}` : ''}`}
                  </div>
                </div>
              ))}
              {phase === 'editing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                  <Spinner size="sm" /> Applying change…
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
          {error && <ErrorNotice message={error} style={{ marginBottom: '10px' }} />}
          {suggestionChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {suggestionChips.map(chip => (
                <button
                  key={chip}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setInstruction(`Weave "${chip}" into the most relevant existing bullet without inventing experience`)
                  }
                  title="Fills the instruction box - review before applying"
                  style={{
                    background: 'var(--card-raised)',
                    color: 'var(--muted)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '999px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  + {chip}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void applyInstruction()
              }
            }}
            rows={2}
            maxLength={500}
            placeholder="Describe a change…"
            disabled={busy}
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'var(--card-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              marginBottom: '10px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => void applyInstruction()}
              disabled={busy || !instruction.trim()}
              className="btn-gold-hover"
              style={{
                flex: 1,
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '9px 14px',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: busy || !instruction.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: busy || !instruction.trim() ? 0.6 : 1,
              }}
            >
              {phase === 'editing' && <Spinner size="sm" />}
              Apply change
            </button>
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={busy}
              style={{
                background: 'var(--card-raised)',
                color: 'var(--text)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {phase === 'downloading' && <Spinner size="sm" />}
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Right: live preview. sandbox="" (no allow-scripts) is the XSS
          containment: even if the AI emitted something executable, the
          iframe cannot run it. */}
      <div style={{ ...card, flex: 1, padding: '16px', display: 'flex' }}>
        <iframe
          title="Resume preview"
          sandbox=""
          srcDoc={`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>${RESUME_CSS} body { padding: 32px 40px; }</style></head><body>${html}</body></html>`}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: '8px',
            background: '#ffffff',
            minHeight: '600px',
          }}
        />
      </div>
    </div>
  )
}
