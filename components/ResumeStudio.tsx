'use client'

// Resume Studio (experimental): a tailoring-focused editing playground.
// Start from an uploaded file, your base resume, or a resume you already
// tailored on the Tailor + ATS page - then edit it two ways: click any line to
// change it directly, or describe a bigger change and let the AI apply it.
//
// Everything works on the structured resume (a ResumeDoc), never on text, so
// no edit can produce something the Word generator cannot render. The default
// tailoring flow stays on Tailor + ATS; this is where you fine-tune the
// result. Editor state lives in the browser only, never in the database:
// sessionStorage holds the working draft for this tab, and Save writes a copy
// to localStorage so the work survives closing it.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Spinner from '@/components/ui/Spinner'
import { createClient } from '@/lib/supabase/client'
import { isDocxFile } from '@/lib/docx/fileType'
import ErrorNotice from '@/components/ui/ErrorNotice'
import ResumePreview from '@/components/resume/ResumePreview'
import DismissibleNote from '@/components/ui/DismissibleNote'
import WordResumeNudge from '@/components/WordResumeNudge'
import type { ResumeDoc } from '@/lib/tagged/schema'
import { readStoredDoc } from '@/lib/tagged/validate'
import { useDocHistory } from '@/components/resume/useDocHistory'
import SlowProgress, { type LoadStage } from '@/components/ui/SlowProgress'
import { debugSlow } from '@/lib/debugSlow'

const STORAGE_KEY = 'vantage-resume-studio-doc'
// Explicit saves go to localStorage, which outlives the tab. The draft above
// does not, so a Save button backed by it would promise more than it delivers.
const SAVED_KEY = 'vantage-resume-studio-saved'
const MAX_FILE_BYTES = 5 * 1024 * 1024

interface EditTurn {
  instruction: string
  status: 'applied' | 'failed'
  note?: string
}

interface TailoredSource {
  documentId: string
  doc: ResumeDoc
  jobTitle: string
  company: string
  skillGaps: string[]
  keywords: string[]
}

// What each wait is actually doing, in the order the route does it. Labels for
// a time estimate rather than progress the server reports - see
// components/ui/SlowProgress.tsx.

// A Word upload is READ, not transcribed: its own paragraphs are the lines, so
// the only model call is the small one asking which lines are headings.
const READ_DOCX_STAGES: LoadStage[] = [
  { label: 'Opening your Word file', seconds: 3 },
  { label: 'Reading its paragraphs', seconds: 4 },
  { label: 'Working out where each section starts', seconds: 8 },
]

// A PDF has no structure to read, so the whole resume has to be transcribed,
// and a transcription that drops a line is retried.
const READ_PDF_STAGES: LoadStage[] = [
  { label: 'Extracting the text', seconds: 5 },
  { label: 'Reading your resume line by line', seconds: 20 },
  { label: 'Checking nothing was left out', seconds: 8 },
]

const EDIT_STAGES: LoadStage[] = [
  { label: 'Applying your change', seconds: 18 },
  { label: 'Checking the result is still a valid resume', seconds: 6 },
]

const DOWNLOAD_STAGES: LoadStage[] = [
  { label: 'Opening your original file', seconds: 3 },
  { label: 'Writing the new wording into it', seconds: 6 },
]

/** Compares documents by value, which is what "unsaved changes" means here. */
function fingerprint(doc: ResumeDoc | null): string {
  return doc ? JSON.stringify(doc) : ''
}

// The saved copy lives in localStorage, so it is read through
// useSyncExternalStore rather than mirrored into React state. Mirroring it
// would mean an effect writing state on mount, and two sources of truth for
// the same question.
const savedListeners = new Set<() => void>()

function subscribeSaved(onChange: () => void): () => void {
  savedListeners.add(onChange)
  // localStorage does not notify the tab that wrote to it.
  window.addEventListener('storage', onChange)
  return () => {
    savedListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readSaved(): string {
  try {
    return localStorage.getItem(SAVED_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeSaved(value: string): void {
  localStorage.setItem(SAVED_KEY, value)
  for (const listener of savedListeners) listener()
}

function clearSaved(): void {
  try {
    localStorage.removeItem(SAVED_KEY)
  } catch {
    // Nothing stored to clear.
  }
  for (const listener of savedListeners) listener()
}

export default function ResumeStudio(): React.ReactElement {
  const history = useDocHistory()
  const doc = history.doc
  // What was last written to the durable copy. Compared by value rather than
  // tracked with a flag, so undoing back to the saved state correctly reports
  // no unsaved changes.
  const savedPrint = useSyncExternalStore(subscribeSaved, readSaved, () => '')
  const [phase, setPhase] = useState<'idle' | 'reading' | 'formatting' | 'editing' | 'downloading'>('idle')
  const [turns, setTurns] = useState<EditTurn[]>([])
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<'docx' | 'pdf' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const turnsRef = useRef<HTMLDivElement>(null)

  // Tailoring-focused start sources: recent tailored resumes + the base resume.
  const [tailoredSources, setTailoredSources] = useState<TailoredSource[]>([])
  const [baseResumeDoc, setBaseResumeDoc] = useState<ResumeDoc | null>(null)
  const [sourcesLoading, setSourcesLoading] = useState(true)
  // Chips shown above the instruction box after seeding from a tailored doc.
  const [suggestionChips, setSuggestionChips] = useState<string[]>([])
  // Which steps this upload is going through. A Word file is read; a PDF has
  // to be transcribed, which is slower and a different list of steps.
  const [uploadStages, setUploadStages] = useState<LoadStage[]>(READ_DOCX_STAGES)

  // Reopen whatever the user left behind: this tab's draft first, then the
  // last explicit save, which is the one that survives closing the tab.
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(STORAGE_KEY)
      const stored = localStorage.getItem(SAVED_KEY)
      // A resume left here by an older build is in the previous format, so it
      // is converted rather than trusted - reading it raw crashed the editor.
      const reopened = readStoredDoc(JSON.parse(draft ?? stored ?? 'null'))
      if (reopened) history.reset(reopened)
    } catch {
      // Storage unavailable or holding a stale shape - start clean.
    }
    // Runs once: reopening on every history change would fight the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load start sources: the user's recent tailored resumes (with job info for
  // labels and suggestion chips) and their base resume. Both already hold a
  // structured document, so opening one costs nothing.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadSources() {
      try {
        const [docsResult, resumeResult] = await Promise.all([
          supabase
            .from('documents')
            .select('id, job_id, skill_gaps, tailored_doc, created_at')
            .eq('type', 'tailored_resume')
            .not('tailored_doc', 'is', null)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('resumes')
            .select('tagged_doc')
            .eq('is_base', true)
            .order('created_at', { ascending: false })
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
        for (const row of docs) {
          const job = row.job_id ? jobById.get(row.job_id) : undefined
          const stored = readStoredDoc(row.tailored_doc)
          if (!job || seenJobs.has(job.id) || !stored) continue
          seenJobs.add(job.id)
          sources.push({
            documentId: row.id,
            doc: stored,
            jobTitle: job.title ?? 'Untitled role',
            company: job.company ?? '',
            skillGaps: Array.isArray(row.skill_gaps) ? row.skill_gaps.slice(0, 4) : [],
            keywords: Array.isArray(job.keywords) ? job.keywords.slice(0, 4) : [],
          })
        }
        setTailoredSources(sources.slice(0, 5))

        // Converted rather than trusted: a row written by an older build is in
        // a previous format, and its paragraph references may not exist yet.
        const baseDoc = readStoredDoc(resumeResult.data?.tagged_doc)
        if (baseDoc) setBaseResumeDoc(baseDoc)
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

  /** Records an edit: one history step, and the draft kept up to date. */
  const saveDoc = useCallback(
    (next: ResumeDoc) => {
      history.set(next)
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Preview still works without persistence.
      }
    },
    [history]
  )

  /** Opening a document starts a fresh history - there is nothing to undo to. */
  const openDoc = useCallback(
    (next: ResumeDoc) => {
      history.reset(next)
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Preview still works without persistence.
      }
    },
    [history]
  )

  const dirty = doc !== null && fingerprint(doc) !== savedPrint

  const saveNow = useCallback(() => {
    if (!doc) return
    try {
      writeSaved(fingerprint(doc))
    } catch {
      // Storage full or blocked. Saying nothing would be worse than saying so:
      // the user would believe their work is safe when it is not.
      setError('Could not save to this browser. Download the file to keep your changes.')
    }
  }, [doc])

  // The editor is a keyboard surface, so it should behave like one.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return

      // Inside a field the browser's own text undo is the right behaviour -
      // undoing the whole document while someone is mid-word is not.
      const target = event.target as HTMLElement | null
      const typing = target?.isContentEditable || target instanceof HTMLTextAreaElement

      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        saveNow()
        return
      }
      if (typing) return

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        history.undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        history.redo()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history, saveNow])

  function startOver() {
    history.reset(null)
    clearSaved()
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

    setUploadStages(isDocxFile(file.name, file.type) ? READ_DOCX_STAGES : READ_PDF_STAGES)
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

      // A Word file comes back already structured, read from its own
      // paragraphs. Only a PDF needs the second call, where the AI has to
      // transcribe it because there is no structure in the file to read.
      let parsed = readStoredDoc(extractJson.doc)

      if (!parsed) {
        setPhase('formatting')
        const genRes = await fetch('/api/resume-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate', text: extractJson.text }),
        })
        const genJson = await genRes.json()
        if (!genRes.ok) {
          setError(genJson.error ?? 'Could not read that resume.')
          return
        }
        parsed = readStoredDoc(genJson.doc)
      }

      if (!parsed) {
        setError('Could not read that resume.')
        return
      }

      await debugSlow()
      setSuggestionChips([])
      openDoc(parsed)
      setTurns([])
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPhase('idle')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Seeding from a tailored resume is instant: the structured document was
  // saved when it was tailored, so there is nothing to fetch or rebuild.
  function startFromTailored(source: TailoredSource) {
    setError(null)
    setSuggestionChips([...new Set([...source.skillGaps, ...source.keywords])].slice(0, 6))
    openDoc(source.doc)
    setTurns([])
  }

  function startFromBase() {
    if (!baseResumeDoc) return
    setError(null)
    setSuggestionChips([])
    openDoc(baseResumeDoc)
    setTurns([])
  }

  async function applyInstruction() {
    const text = instruction.trim()
    if (!text || !doc || phase !== 'idle') return
    setError(null)
    setInstruction('')
    setPhase('editing')
    try {
      const res = await fetch('/api/resume-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', doc, instruction: text }),
      })
      const json = await res.json()
      if (!res.ok) {
        setTurns(prev => [...prev, { instruction: text, status: 'failed', note: json.error }])
        return
      }
      await debugSlow()
      saveDoc(json.doc as ResumeDoc)
      setTurns(prev => [...prev, { instruction: text, status: 'applied' }])
    } catch {
      setTurns(prev => [...prev, { instruction: text, status: 'failed', note: 'Network error' }])
    } finally {
      setPhase('idle')
    }
  }

  async function download(format: 'docx' | 'pdf') {
    if (!doc || phase !== 'idle') return
    setError(null)
    setDownloadFormat(format)
    setPhase('downloading')
    try {
      const res = await fetch('/api/resume-studio/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc, format }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? 'Could not create the file.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resume.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPhase('idle')
      setDownloadFormat(null)
    }
  }

  const busy = phase !== 'idle'

  const card: React.CSSProperties = {
    background: 'var(--card)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
  }

  // ---- Upload state ----------------------------------------------------------

  if (!doc) {
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
        {/* data-tour: the walkthrough points at the whole source picker, NOT at
            an individual tailored-resume button - those only exist once
            something has been tailored, so anchoring to one meant the step
            silently skipped itself for anyone who had not. */}
        <div style={{ maxWidth: '520px', margin: '0 auto' }} data-tour="studio-sources">
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
                    onClick={() => startFromTailored(source)}
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
            {baseResumeDoc && (
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
                {phase === 'reading' ? 'Reading file…' : phase === 'formatting' ? 'Reading resume…' : 'Upload a file'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                PDF or Word, up to 5MB. Read once, never stored.
              </div>
            </button>
            {/* Reading a PDF means transcribing the whole resume, which is the
                longest wait in the Studio by some way. */}
            <SlowProgress
              active={phase === 'reading' || phase === 'formatting'}
              stages={uploadStages}
              style={{ marginTop: '12px' }}
            />
          </div>

          {sourcesLoading && tailoredSources.length === 0 && !baseResumeDoc && (
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
    // data-tour: the editor exists only once a resume has been opened, which is
    // what the walkthrough waits for on this page.
    <div className="studio-layout" data-tour="studio-loaded">
      {/* Left: instructions */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column' }} className="studio-sidebar">
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
              Click any line in the resume to edit it directly. For bigger changes,
              describe one here:
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
                  <div style={{ fontSize: '11px', marginTop: '4px', color: turn.status === 'applied' ? 'var(--muted)' : 'var(--score-red)' }}>
                    {turn.status === 'applied' ? 'Applied' : `Failed${turn.note ? `: ${turn.note}` : ''}`}
                  </div>
                </div>
              ))}
              {phase === 'editing' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                    <Spinner size="sm" /> Applying change…
                  </div>
                  <SlowProgress active stages={EDIT_STAGES} style={{ marginTop: '4px' }} />
                </>
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
            {(['docx', 'pdf'] as const).map(format => (
              <button
                key={format}
                type="button"
                onClick={() => void download(format)}
                disabled={busy}
                title={
                  format === 'docx'
                    ? 'Keeps the design of your uploaded resume or template'
                    : 'A clean standard layout - your own design only comes through in the Word file'
                }
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
                {downloadFormat === format && <Spinner size="sm" />}
                {format === 'docx' ? 'Word' : 'PDF'}
              </button>
            ))}
          </div>
          {/* No AI in a download, so this rarely appears - but a cold start or
              a large template can still outlast a spinner's credibility. */}
          <SlowProgress
            active={downloadFormat !== null}
            stages={DOWNLOAD_STAGES}
            style={{ marginTop: '12px' }}
          />
        </div>
      </div>

      {/* Right: the live, directly editable resume. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="studio-toolbar">
          <div className="studio-toolbar-actions">
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="Undo (Ctrl+Z)"
              className="studio-tool"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8h7a3.5 3.5 0 0 1 0 7H7" />
                <path d="M6 5 3 8l3 3" />
              </svg>
              Undo
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="studio-tool"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 8H6a3.5 3.5 0 0 0 0 7h3" />
                <path d="m10 5 3 3-3 3" />
              </svg>
              Redo
            </button>
          </div>

          <div className="studio-toolbar-save">
            {/* Says which of the two things is true rather than always
                claiming one of them. */}
            <span className="studio-save-state">
              {dirty ? 'Unsaved changes' : 'Saved to this browser'}
            </span>
            <button
              type="button"
              onClick={saveNow}
              disabled={!dirty}
              title="Save (Ctrl+S)"
              className="studio-tool studio-tool-primary"
            >
              {dirty ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3h7l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                  <path d="M5 3v4h5V3M5 14v-4h6v4" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m3 8.5 3.5 3.5L13 5" />
                </svg>
              )}
              {dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        <WordResumeNudge style={{ marginBottom: '12px' }} />
        <DismissibleNote id="studio-download-formats" style={{ marginBottom: '12px' }}>
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Word keeps your formatting.</strong>{' '}
          It is your uploaded resume with the new wording in it, so your fonts and layout are
          untouched. The PDF has the same content and working links but uses a standard layout.
        </DismissibleNote>
        <ResumePreview doc={doc} onChange={saveDoc} />
      </div>
    </div>
  )
}
