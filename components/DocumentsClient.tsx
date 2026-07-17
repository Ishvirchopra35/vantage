'use client'

// Documents page body: tailored resumes and cover letters with preview,
// copy, download, and delete.
import { useState } from 'react'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import TailorDiff, { formatTailoredBullets } from '@/components/TailorDiff'
import type { DocumentRow } from '@/app/(dashboard)/documents/page'

// --- Types --------------------------------------------------------------------

type FilterType = 'all' | 'tailored_resume' | 'cover_letter'

interface Props {
  documents: DocumentRow[]
}

// --- Helpers -----------------------------------------------------------------

function firstJob(
  jobs: DocumentRow['jobs']
): { title: string | null; company: string | null } | null {
  if (!jobs) return null
  if (Array.isArray(jobs)) return jobs[0] ?? null
  return jobs
}

function docTypeLabel(type: DocumentRow['type']): string {
  return type === 'tailored_resume' ? 'Tailored Resume' : 'Cover Letter'
}

function formatDate(dateValue: string): string {
  // Fixed locale + UTC so the SSR and client render identical text (hydration safety)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateValue))
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

// --- Row ---------------------------------------------------------------------

function DocumentRow({ doc }: { doc: DocumentRow }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const job = firstJob(doc.jobs)
  const label = docTypeLabel(doc.type)
  const isTailoredResume = doc.type === 'tailored_resume'

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    // Tailored resumes copy only their tailored bullets; the full rewritten
    // text never reaches the client.
    const text = isTailoredResume ? formatTailoredBullets(doc.changes ?? []) : (doc.content ?? '')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    const company = job?.company || 'Document'
    const title = job?.title || ''
    downloadAsPDF(doc.content ?? '', `${company}${title ? ` - ${title}` : ''} - ${label}.pdf`)
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
  }

  const typeBadge: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    background: doc.type === 'tailored_resume' ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.12)',
    color: doc.type === 'tailored_resume' ? '#818cf8' : '#22c55e',
    marginBottom: '6px',
    flexShrink: 0,
  }

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-md)',
        padding: '16px 20px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onClick={() => setExpanded(prev => !prev)}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-raised)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ minWidth: 0 }}>
          <span style={typeBadge}>{label}</span>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job?.title && job?.company
              ? `${job.title} · ${job.company}`
              : job?.title || job?.company || 'Untitled'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {formatDate(doc.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={handleCopy} style={smallBtn}>
            {copied ? 'Copied!' : isTailoredResume ? 'Copy bullets' : 'Copy'}
          </button>
          {!isTailoredResume && (
            <button type="button" onClick={handleDownload} style={smallBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </button>
          )}
        </div>
      </div>

      {expanded && (
        isTailoredResume ? (
          <div style={{ marginTop: '12px', maxHeight: '400px', overflowY: 'auto' }}>
            {(doc.changes ?? []).length > 0 ? (
              <TailorDiff changes={doc.changes ?? []} />
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '8px 0' }}>
                This resume was tailored, but no per-bullet changes were recorded.
              </div>
            )}
          </div>
        ) : (
          <pre style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px',
            marginTop: '12px',
            overflowY: 'auto',
            maxHeight: '400px',
            margin: '12px 0 0',
            color: 'var(--text)',
          }}>
            {doc.content}
          </pre>
        )
      )}
    </div>
  )
}

// --- Main ---------------------------------------------------------------------

export default function DocumentsClient({ documents }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = filter === 'all'
    ? documents
    : documents.filter(d => d.type === filter)

  const pillBase: React.CSSProperties = {
    padding: '5px 14px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'transparent',
  }

  const tabs: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Tailored Resume', value: 'tailored_resume' },
    { label: 'Cover Letter', value: 'cover_letter' },
  ]

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <PageHeader
        title="Documents"
        subtitle="All your tailored resumes and cover letters."
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            style={{
              ...pillBase,
              background: filter === tab.value ? 'var(--border)' : 'transparent',
              color: filter === tab.value ? 'var(--text)' : 'var(--muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Tailor your first resume to get started."
          actionLabel="Go to Tailor"
          actionHref="/tailor"
        />
      ) : (
        <div>
          {filtered.map(doc => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
