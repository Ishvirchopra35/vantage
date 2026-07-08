'use client'

import { useState, useEffect } from 'react'

// --- Types --------------------------------------------------------------------

type AppStatus = 'applied' | 'interviewing' | 'offer' | 'rejected' | 'ghosted'

interface Application {
  id: string
  company: string
  role: string
  status: AppStatus
  applied_date: string | null
  notes: string | null
  job_id: string | null
}

interface Document {
  id: string
  type: 'tailored_resume' | 'cover_letter'
  content: string
  skill_gaps: string[] | null
  created_at: string
}

interface AtsScore {
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

interface DetailsData {
  application: Application
  documents: Document[]
  atsScore: AtsScore | null
}

interface Props {
  applicationId: string
  onClose: () => void
}

// --- Status badge maps (mirrors tracker page) --------------------------------

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

// --- Helpers -----------------------------------------------------------------

function scoreColor(n: number): string {
  if (n >= 75) return 'var(--score-green)'
  if (n >= 50) return 'var(--score-amber)'
  return 'var(--score-red)'
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function downloadAsPDF(content: string, filename: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) return
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${filename}</title><style>
    body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial;font-size:11pt;line-height:1.5;color:#000;background:#fff;}
    .page{padding:40px;max-width:700px;margin:0 auto;}
    pre{white-space:pre-wrap;font-family:inherit;font-size:11pt;line-height:1.5;}
  </style></head><body><div class="page"><pre>${escapeHtml(content)}</pre></div></body></html>`
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch {}
    setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 500)
  }, 200)
}

// --- Skeleton ----------------------------------------------------------------

function ModalSkeleton() {
  const shimmer = { animation: 'shimmer 1.4s ease infinite', background: 'var(--border)', borderRadius: '6px' }
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ ...shimmer, width: '200px', height: '24px', marginBottom: '10px' }} />
          <div style={{ ...shimmer, width: '140px', height: '16px', marginBottom: '10px' }} />
          <div style={{ ...shimmer, width: '80px', height: '20px' }} />
        </div>
      </div>
      <div style={{ ...shimmer, width: '100%', height: '120px', borderRadius: '10px', marginBottom: '24px' }} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ ...shimmer, width: '130px', height: '32px', borderRadius: '8px' }} />
        <div style={{ ...shimmer, width: '110px', height: '32px', borderRadius: '8px' }} />
      </div>
      <div style={{ ...shimmer, width: '100%', height: '240px', borderRadius: '10px' }} />
    </>
  )
}

// --- Modal --------------------------------------------------------------------

export default function ApplicationDetailModal({ applicationId, onClose }: Props) {
  const [data, setData] = useState<DetailsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'resume' | 'cover'>('resume')
  const [copied, setCopied] = useState<'resume' | 'cover' | null>(null)

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/applications/${applicationId}/details`)
        const json = await res.json()
        if (!res.ok) {
          setFetchError(json.error ?? 'Failed to load details.')
          return
        }
        const details = json as DetailsData
        setData(details)
        const hasResume = details.documents.some(d => d.type === 'tailored_resume')
        setActiveTab(hasResume ? 'resume' : 'cover')
      } catch {
        setFetchError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [applicationId])

  async function copyToClipboard(text: string, type: 'resume' | 'cover'): Promise<void> {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const smallBtn: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  const resumeDoc = data?.documents.find(d => d.type === 'tailored_resume')
  const coverDoc = data?.documents.find(d => d.type === 'cover_letter')
  const activeDoc = activeTab === 'resume' ? resumeDoc : coverDoc
  const hasDocTabs = !!(resumeDoc || coverDoc)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          padding: '32px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {loading && <ModalSkeleton />}

        {!loading && fetchError && (
          <div style={{ color: 'var(--score-red)', fontSize: '14px' }}>{fetchError}</div>
        )}

        {!loading && !fetchError && data && (
          <>
            {/* -- Header ------------------------------------------------ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  {data.application.company}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '12px' }}>
                  {data.application.role}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    background: STATUS_COLOR[data.application.status],
                    color: STATUS_TEXT[data.application.status],
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                  }}>
                    {STATUS_LABEL[data.application.status]}
                  </span>
                  {data.application.applied_date && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Applied {new Date(data.application.applied_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '22px',
                  lineHeight: 1,
                  padding: '0 4px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* -- ATS Score --------------------------------------------- */}
            {data.atsScore && (
              <div style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px',
                marginBottom: '24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '42px', fontWeight: 700, lineHeight: 1, color: scoreColor(data.atsScore.overall_score) }}>
                      {data.atsScore.overall_score}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>ATS score</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1, color: scoreColor(data.atsScore.keyword_score) }}>
                      {data.atsScore.keyword_score}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Keywords</div>
                  </div>
                </div>

                {data.atsScore.missing_keywords.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Missing keywords
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {data.atsScore.missing_keywords.map(kw => (
                        <span key={kw} style={{
                          background: 'rgba(239,68,68,0.1)',
                          color: '#ef4444',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          fontSize: '12px',
                        }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {data.atsScore.suggestions.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Suggestions
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      {data.atsScore.suggestions.map((s, i) => (
                        <li key={i} style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '5px', lineHeight: 1.5 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* -- Documents --------------------------------------------- */}
            {hasDocTabs ? (
              <div>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
                  {resumeDoc && (
                    <button
                      onClick={() => setActiveTab('resume')}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'resume' ? '2px solid var(--text)' : '2px solid transparent',
                        color: activeTab === 'resume' ? 'var(--text)' : 'var(--muted)',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: activeTab === 'resume' ? 600 : 400,
                        cursor: 'pointer',
                        marginBottom: '-1px',
                      }}
                    >
                      Tailored Resume
                    </button>
                  )}
                  {coverDoc && (
                    <button
                      onClick={() => setActiveTab('cover')}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'cover' ? '2px solid var(--text)' : '2px solid transparent',
                        color: activeTab === 'cover' ? 'var(--text)' : 'var(--muted)',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: activeTab === 'cover' ? 600 : 400,
                        cursor: 'pointer',
                        marginBottom: '-1px',
                      }}
                    >
                      Cover Letter
                    </button>
                  )}
                </div>

                {activeDoc && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '14px' }}>
                      <button onClick={() => copyToClipboard(activeDoc.content, activeTab)} style={smallBtn}>
                        {copied === activeTab ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => downloadAsPDF(
                          activeDoc.content,
                          `${data.application.company} - ${data.application.role} - ${activeTab === 'resume' ? 'Tailored Resume' : 'Cover Letter'}.pdf`
                        )}
                        style={smallBtn}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download PDF
                      </button>
                    </div>
                    <pre style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '16px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      margin: 0,
                      color: 'var(--text)',
                    }}>
                      {activeDoc.content}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>
                No tailored documents for this application yet.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
