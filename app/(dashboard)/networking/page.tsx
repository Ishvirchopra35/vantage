'use client'

import { useState, useEffect, useRef } from 'react'
import { rateLimitMessage } from '@/lib/rateLimitMessage'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/ui/Spinner'
import SkeletonLoader from '@/components/ui/SkeletonLoader'
import CustomSelect from '@/components/CustomSelect'
import PageHeader from '@/components/ui/PageHeader'
import ExternalLinkIcon from '@/components/ui/ExternalLinkIcon'

// --- Types --------------------------------------------------------------------

type MessageType = 'connection_request' | 'cold_email' | 'follow_up'

interface Contact {
  name: string
  title: string
  company: string
  linkedin: string
  snippet: string
  source: 'serpapi'
}

// A job option sourced from the application tracker. Manual applications
// have no jobs row, so jobId is null and title/company come from the
// application itself.
interface TrackedJobOption {
  key: string
  jobId: string | null
  title: string
  company: string
}

interface OutreachMessage {
  id: string
  contact_name: string
  contact_title: string
  contact_company: string
  contact_linkedin_url: string | null
  message_type: MessageType
  // Null for manually logged messages - those live in user_edited_message.
  generated_message: string | null
  user_edited_message: string | null
  sent: boolean
  sent_at: string | null
  job_id: string | null
  created_at: string
}

// --- Constants ----------------------------------------------------------------

const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  connection_request: 'LinkedIn connection request',
  cold_email: 'Cold email',
  follow_up: 'Follow-up',
}

const TYPE_BADGE_COLORS: Record<MessageType, React.CSSProperties> = {
  connection_request: { background: 'rgba(99,102,241,0.12)', color: '#818cf8' },
  cold_email: { background: 'rgba(34,197,94,0.1)', color: '#4ade80' },
  follow_up: { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
}

// --- Card ---------------------------------------------------------------------

function ContactCard({ contact, onUse }: { contact: Contact; onUse: (c: Contact) => void }) {
  return (
    <div style={{
      background: 'var(--card)',
      boxShadow: 'var(--shadow-md)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
          {contact.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {contact.title}{contact.title && contact.company ? ' · ' : ''}{contact.company}
        </div>
      </div>
      {contact.snippet && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
          {contact.snippet}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <a
          href={contact.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            textDecoration: 'none',
            background: 'var(--card-raised)',
            borderRadius: '20px',
            padding: '4px 10px',
          }}
        >
          View Profile <ExternalLinkIcon size={11} />
        </a>
        <button
          type="button"
          onClick={() => onUse(contact)}
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            color: 'var(--btn-primary-text)',
            background: 'var(--btn-primary-bg)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          Generate connection request
        </button>
      </div>
    </div>
  )
}

// --- Page ---------------------------------------------------------------------

export default function NetworkingPage() {
  const supabase = createClient()

  // Section 1 - Find contacts
  const [searchCompany, setSearchCompany] = useState('')
  const [searchRole, setSearchRole] = useState('')
  const [searching, setSearching] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSource, setContactSource] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchDone, setSearchDone] = useState(false)
  const [searchEmptyMessage, setSearchEmptyMessage] = useState<string | null>(null)

  // Section 2 - Generate message
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactCompany, setContactCompany] = useState('')
  const [contactLinkedinUrl, setContactLinkedinUrl] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('connection_request')
  const [selectedJobKey, setSelectedJobKey] = useState('')
  const [jobs, setJobs] = useState<TrackedJobOption[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [savedRow, setSavedRow] = useState<OutreachMessage | null>(null)
  const [savingEdits, setSavingEdits] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const generateSectionRef = useRef<HTMLDivElement>(null)

  // Refine: a free-text instruction that rewrites the generated message
  // (counts against the same networking limits as generating)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refining, setRefining] = useState(false)

  // Section 3 - Tracker
  const [messages, setMessages] = useState<OutreachMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  // Manual logging - messages the user wrote/sent outside the generator
  const [logOpen, setLogOpen] = useState(false)
  const [logName, setLogName] = useState('')
  const [logTitle, setLogTitle] = useState('')
  const [logCompany, setLogCompany] = useState('')
  const [logLinkedin, setLogLinkedin] = useState('')
  const [logType, setLogType] = useState<MessageType>('connection_request')
  const [logMessage, setLogMessage] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  // Load jobs and messages on mount
  useEffect(() => {
    void loadJobs()
    void loadMessages()
  }, [])

  async function loadJobs() {
    // Source the dropdown from the application tracker, not the jobs table -
    // manual tracker rows have no jobs record and would otherwise be missing.
    // Fetch apps first, then enrich titles/companies from jobs separately.
    const { data: appsData } = await supabase
      .from('applications')
      .select('id, job_id, role, company')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    const appRows = (appsData ?? []) as Array<{ id: string; job_id: string | null; role: string; company: string }>

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
    const options: TrackedJobOption[] = []
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
    setJobs(options)
  }

  async function loadMessages() {
    setLoadingMessages(true)
    const { data } = await supabase
      .from('outreach_messages')
      .select('id, contact_name, contact_title, contact_company, contact_linkedin_url, message_type, generated_message, user_edited_message, sent, sent_at, job_id, created_at')
      .order('created_at', { ascending: false })
    setMessages((data ?? []) as OutreachMessage[])
    setLoadingMessages(false)
  }

  function prefillFromContact(contact: Contact) {
    setContactName(contact.name)
    setContactTitle(contact.title)
    setContactCompany(contact.company)
    setContactLinkedinUrl(contact.linkedin)
    setMessageType('connection_request')
    setGeneratedText('')
    setEditedText('')
    setSavedRow(null)
    setGenerateError(null)
    setTimeout(() => {
      generateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function prefillFollowUp(msg: OutreachMessage) {
    setContactName(msg.contact_name)
    setContactTitle(msg.contact_title)
    setContactCompany(msg.contact_company)
    setContactLinkedinUrl(msg.contact_linkedin_url ?? '')
    setMessageType('follow_up')
    // Linked jobs use the jobs.id as their option key, so this round-trips.
    setSelectedJobKey(msg.job_id ?? '')
    setGeneratedText('')
    setEditedText('')
    setSavedRow(null)
    setGenerateError(null)
    setTimeout(() => {
      generateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  async function handleSearch() {
    if (!searchCompany.trim()) return
    setSearching(true)
    setSearchError(null)
    setContacts([])
    setContactSource(null)
    setSearchEmptyMessage(null)
    setSearchDone(false)

    const res = await fetch('/api/find-contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: searchCompany.trim(), role: searchRole.trim() || undefined }),
    })
    const json = await res.json()

    if (res.status === 429) {
      setSearchError(json.message || json.error || rateLimitMessage(json.retryAfter))
    } else if (!res.ok) {
      setSearchError(json.error ?? 'Search failed')
    } else {
      setContacts(json.contacts ?? [])
      setContactSource(json.source ?? null)
      setSearchEmptyMessage(json.message ?? null)
      setSearchDone(true)
    }
    setSearching(false)
  }

  async function handleGenerate() {
    if (!contactName.trim() || !contactCompany.trim()) return
    setGenerating(true)
    setGenerateError(null)
    setGeneratedText('')
    setEditedText('')
    setSavedRow(null)

    // Manual tracker entries have no jobs row - pass their title/company as
    // plain-text job context instead of a jobId.
    const selectedJob = jobs.find(j => j.key === selectedJobKey)
    const res = await fetch('/api/generate-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: contactName.trim(),
        contactTitle: contactTitle.trim(),
        contactCompany: contactCompany.trim(),
        contactLinkedinUrl: contactLinkedinUrl.trim() || undefined,
        messageType,
        jobId: selectedJob?.jobId || undefined,
        jobTitle: selectedJob && !selectedJob.jobId ? selectedJob.title : undefined,
        jobCompany: selectedJob && !selectedJob.jobId ? selectedJob.company : undefined,
      }),
    })
    const json = await res.json()

    if (res.status === 429) {
      setGenerateError(json.error || rateLimitMessage(json.retryAfter))
    } else if (!res.ok) {
      setGenerateError(json.error ?? 'Generation failed')
    } else {
      const msg = json.message as OutreachMessage
      setGeneratedText(msg.generated_message ?? '')
      setEditedText(msg.generated_message ?? '')
      setSavedRow(msg)
      setMessages(prev => [msg, ...prev])
    }
    setGenerating(false)
  }

  async function handleRefine() {
    if (!savedRow || !refineInstruction.trim() || refining) return
    setRefining(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/generate-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: savedRow.contact_name,
          contactTitle: savedRow.contact_title ?? '',
          contactCompany: savedRow.contact_company,
          messageType: savedRow.message_type,
          refineMessageId: savedRow.id,
          refineInstruction: refineInstruction.trim(),
        }),
      })
      const json = await res.json()
      if (res.status === 429) {
        setGenerateError(json.error || rateLimitMessage(json.retryAfter))
        return
      }
      if (!res.ok) {
        setGenerateError(json.error ?? 'Could not refine the message.')
        return
      }
      const msg = json.message as OutreachMessage
      setGeneratedText(msg.generated_message ?? '')
      setEditedText(msg.generated_message ?? '')
      setSavedRow(msg)
      setMessages(prev => prev.map(m => (m.id === msg.id ? msg : m)))
      setRefineInstruction('')
    } catch {
      setGenerateError('Network error. Please try again.')
    } finally {
      setRefining(false)
    }
  }

  async function handleSaveEdits() {
    if (!savedRow || editedText === generatedText) return
    setSavingEdits(true)
    await supabase
      .from('outreach_messages')
      .update({ user_edited_message: editedText })
      .eq('id', savedRow.id)
    setMessages(prev =>
      prev.map(m => m.id === savedRow.id ? { ...m, user_edited_message: editedText } : m)
    )
    setSavingEdits(false)
  }

  function handleCopy() {
    void navigator.clipboard.writeText(editedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleToggleSent(msg: OutreachMessage) {
    setTogglingIds(prev => new Set([...prev, msg.id]))
    const updates = msg.sent
      ? { sent: false, sent_at: null }
      : { sent: true, sent_at: new Date().toISOString() }
    await supabase.from('outreach_messages').update(updates).eq('id', msg.id)
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...updates } : m))
    setTogglingIds(prev => { const s = new Set(prev); s.delete(msg.id); return s })
  }

  async function handleLogMessage() {
    if (!logName.trim() || !logCompany.trim() || !logMessage.trim()) {
      setLogError('Contact name, company, and the message are required.')
      return
    }
    setLogSaving(true)
    setLogError(null)
    try {
      const res = await fetch('/api/outreach-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: logName.trim(),
          contactTitle: logTitle.trim() || undefined,
          contactCompany: logCompany.trim(),
          contactLinkedinUrl: logLinkedin.trim() || undefined,
          messageType: logType,
          message: logMessage.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setLogError(json.error ?? 'Could not log the message.')
        return
      }
      setMessages(prev => [json.message as OutreachMessage, ...prev])
      setLogOpen(false)
      setLogName(''); setLogTitle(''); setLogCompany(''); setLogLinkedin(''); setLogMessage('')
      setLogType('connection_request')
    } catch {
      setLogError('Network error. Please try again.')
    } finally {
      setLogSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setConfirmingDeleteId(null)
    setDeletingIds(prev => new Set([...prev, id]))
    await supabase.from('outreach_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
    setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  // -- Shared styles ------------------------------------------------------------

  const card: React.CSSProperties = {
    background: 'var(--card)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    padding: '24px',
    marginBottom: '20px',
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: '16px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--card-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  // Variant for inputs that sit on a card-raised panel (the manual-log form):
  // the page background + stronger border keeps them visible on that surface.
  const logInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '6px',
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
  }

  const ghostBtn: React.CSSProperties = {
    background: 'var(--card-raised)',
    color: 'var(--muted)',
    border: 'none',
    borderRadius: '8px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  }

  const charCount = editedText.length
  const isConnectionRequest = messageType === 'connection_request'
  const charWarning = isConnectionRequest && charCount > 280

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Networking"
        subtitle="Find contacts and generate personalised outreach messages."
      />

      {/* -- Section 1: Find contacts ---------------------------------------- */}
      <div style={card}>
        <div style={sectionTitle}>1 · Find contacts</div>
        <div className="rsp-grid-2" style={{ gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Company</label>
            <input autoComplete="off"
              type="text"
              value={searchCompany}
              onChange={e => setSearchCompany(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSearch()}
              placeholder="e.g. Shopify"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Role to target (optional)</label>
            <input autoComplete="off"
              type="text"
              value={searchRole}
              onChange={e => setSearchRole(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSearch()}
              placeholder="e.g. recruiter, engineering manager"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={searching || !searchCompany.trim()}
          className="btn-gold-hover"
          style={{ ...primaryBtn, opacity: searching || !searchCompany.trim() ? 0.6 : 1 }}
        >
          {searching && <Spinner size="sm" />}
          {searching ? 'Searching…' : 'Find contacts'}
        </button>

        {searchError && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#ef4444' }}>{searchError}</div>
        )}

        {searchDone && contacts.length === 0 && (
          <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--muted)' }}>
            {searchEmptyMessage ?? 'No contacts found. Try a broader role or different company spelling.'}
          </div>
        )}

        {contacts.length > 0 && (
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {contacts.map((c, i) => (
              <ContactCard key={i} contact={c} onUse={prefillFromContact} />
            ))}
          </div>
        )}
      </div>

      {/* -- Section 2: Generate message ------------------------------------- */}
      <div style={card} ref={generateSectionRef}>
        <div style={sectionTitle}>2 · Generate message</div>
        <div className="rsp-grid-3" style={{ gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Contact name</label>
            <input autoComplete="off" type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input autoComplete="off" type="text" value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Senior Recruiter" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input autoComplete="off" type="text" value={contactCompany} onChange={e => setContactCompany(e.target.value)} placeholder="Shopify" style={inputStyle} />
          </div>
        </div>

        <div className="rsp-grid-3" style={{ gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>LinkedIn URL (optional)</label>
            <input autoComplete="off" type="text" value={contactLinkedinUrl} onChange={e => setContactLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Message type</label>
            <CustomSelect
              value={messageType}
              onChange={v => setMessageType(v as MessageType)}
              options={[
                { value: 'connection_request', label: 'LinkedIn connection request' },
                { value: 'cold_email', label: 'Cold email' },
                { value: 'follow_up', label: 'Follow-up' },
              ]}
            />
          </div>
          <div>
            <label style={labelStyle}>Job (optional)</label>
            <CustomSelect
              value={selectedJobKey}
              onChange={setSelectedJobKey}
              options={[
                { value: '', label: 'No specific job' },
                ...jobs.map(j => ({ value: j.key, label: `${j.title} - ${j.company}` })),
              ]}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating || !contactName.trim() || !contactCompany.trim()}
          className="btn-gold-hover"
          style={{ ...primaryBtn, opacity: generating || !contactName.trim() || !contactCompany.trim() ? 0.6 : 1 }}
        >
          {generating && <Spinner size="sm" />}
          {generating ? 'Generating…' : 'Generate'}
        </button>

        {generateError && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#ef4444' }}>{generateError}</div>
        )}

        {editedText && (
          <div style={{ marginTop: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                {MESSAGE_TYPE_LABELS[messageType]}
              </label>
              {isConnectionRequest && (
                <span style={{ fontSize: '11px', color: charWarning ? '#ef4444' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {charCount} / 280
                </span>
              )}
            </div>
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              rows={messageType === 'cold_email' ? 8 : 5}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                borderColor: charWarning ? '#ef4444' : 'var(--border)',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
              <button type="button" onClick={handleCopy} style={ghostBtn}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              {editedText !== generatedText && (
                <button
                  type="button"
                  onClick={() => void handleSaveEdits()}
                  disabled={savingEdits}
                  style={{ ...ghostBtn, opacity: savingEdits ? 0.6 : 1 }}
                >
                  {savingEdits ? 'Saving…' : 'Save edits'}
                </button>
              )}
              {savedRow && (
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>
                  Saved to tracker
                </span>
              )}
            </div>

            {/* Refine - free-text instruction that rewrites the message above.
                Uses the same networking limits as generating a new message. */}
            {savedRow && (
              <div style={{ marginTop: '14px' }}>
                <label style={labelStyle}>Want changes? Describe them</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    autoComplete="off"
                    type="text"
                    value={refineInstruction}
                    onChange={e => setRefineInstruction(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && void handleRefine()}
                    maxLength={300}
                    placeholder="e.g. make it shorter, mention my co-op, sound less formal"
                    disabled={refining}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleRefine()}
                    disabled={refining || !refineInstruction.trim()}
                    className="btn-gold-hover"
                    style={{
                      ...primaryBtn,
                      padding: '9px 16px',
                      whiteSpace: 'nowrap',
                      opacity: refining || !refineInstruction.trim() ? 0.6 : 1,
                    }}
                  >
                    {refining && <Spinner size="sm" />}
                    {refining ? 'Rewriting…' : 'Rewrite'}
                  </button>
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                  Rewrites count toward your networking message limit.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -- Section 3: Tracker ---------------------------------------------- */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ ...sectionTitle, marginBottom: 0 }}>3 · Outreach tracker</div>
          <button type="button" onClick={() => { setLogOpen(o => !o); setLogError(null) }} style={ghostBtn}>
            {logOpen ? 'Close' : 'Log a message'}
          </button>
        </div>

        {/* Manual entry - track a message written and sent outside Vantage.
            Inputs sit on a raised panel, so they use the page background +
            a border to stay visually separated from the panel itself. */}
        {logOpen && (
          <div style={{
            background: 'var(--card-raised)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            marginBottom: '18px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Contact name *</label>
                <input autoComplete="off" value={logName} onChange={e => setLogName(e.target.value)} style={logInputStyle} placeholder="Jane Doe" />
              </div>
              <div>
                <label style={labelStyle}>Contact title</label>
                <input autoComplete="off" value={logTitle} onChange={e => setLogTitle(e.target.value)} style={logInputStyle} placeholder="Engineering Manager" />
              </div>
              <div>
                <label style={labelStyle}>Company *</label>
                <input autoComplete="off" value={logCompany} onChange={e => setLogCompany(e.target.value)} style={logInputStyle} placeholder="Shopify" />
              </div>
              <div>
                <label style={labelStyle}>LinkedIn URL</label>
                <input autoComplete="off" value={logLinkedin} onChange={e => setLogLinkedin(e.target.value)} style={logInputStyle} placeholder="https://linkedin.com/in/…" />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <CustomSelect
                  value={logType}
                  onChange={v => setLogType(v as MessageType)}
                  options={[
                    { value: 'connection_request', label: MESSAGE_TYPE_LABELS.connection_request },
                    { value: 'cold_email', label: MESSAGE_TYPE_LABELS.cold_email },
                    { value: 'follow_up', label: MESSAGE_TYPE_LABELS.follow_up },
                  ]}
                />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Your message *</label>
              <textarea
                value={logMessage}
                onChange={e => setLogMessage(e.target.value)}
                rows={4}
                style={{ ...logInputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                placeholder="Paste the message you sent…"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void handleLogMessage()}
                disabled={logSaving}
                style={{ ...primaryBtn, opacity: logSaving ? 0.7 : 1 }}
              >
                {logSaving && <Spinner size="sm" />}
                {logSaving ? 'Saving…' : 'Save to tracker'}
              </button>
              {logError && <span style={{ fontSize: '12px', color: '#ef4444' }}>{logError}</span>}
            </div>
          </div>
        )}

        {loadingMessages ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => (
              <SkeletonLoader key={i} height={40} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ width: '36px', height: '36px', margin: '0 auto 14px', background: 'var(--card-raised)', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>No outreach yet</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)' }}>Generate a message above or log one you sent yourself - drafts and sent messages land here.</div>
          </div>
        ) : (
          <div className="fade-in" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Contact', 'Company', 'Type', 'Preview', 'Sent', 'Date', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0 12px 10px 0', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, msgIdx) => {
                  const displayText = msg.user_edited_message ?? msg.generated_message ?? ''
                  const toggling = togglingIds.has(msg.id)
                  const deleting = deletingIds.has(msg.id)
                  return (
                    <tr
                      key={msg.id}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-raised)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = msgIdx % 2 === 0 ? 'var(--card-sunken)' : 'transparent' }}
                      style={{ background: msgIdx % 2 === 0 ? 'var(--card-sunken)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}
                    >
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {msg.contact_linkedin_url ? (
                          <a href={msg.contact_linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                            {msg.contact_name} <ExternalLinkIcon size={11} />
                          </a>
                        ) : msg.contact_name}
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{msg.contact_company}</td>
                      <td style={{ padding: '12px 12px 12px 0', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '20px',
                          ...TYPE_BADGE_COLORS[msg.message_type],
                        }}>
                          {MESSAGE_TYPE_LABELS[msg.message_type]}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayText.slice(0, 60)}{displayText.length > 60 ? '…' : ''}
                      </td>
                      <td style={{ padding: '12px 12px 12px 0' }}>
                        <button
                          type="button"
                          onClick={() => void handleToggleSent(msg)}
                          disabled={toggling}
                          title={msg.sent ? 'Mark as not sent' : 'Mark as sent'}
                          style={{
                            width: '32px',
                            height: '18px',
                            borderRadius: '9px',
                            border: 'none',
                            background: msg.sent ? '#22c55e' : 'var(--border)',
                            cursor: toggling ? 'not-allowed' : 'pointer',
                            position: 'relative',
                            transition: 'background 0.15s',
                            flexShrink: 0,
                          }}
                        >
                          <span style={{
                            position: 'absolute',
                            top: '2px',
                            left: msg.sent ? '16px' : '2px',
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: '#fff',
                            transition: 'left 0.15s',
                          }} />
                        </button>
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 0', whiteSpace: 'nowrap' }}>
                        {confirmingDeleteId === msg.id ? (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Delete?</span>
                            <button
                              type="button"
                              onClick={() => void handleDelete(msg.id)}
                              disabled={deleting}
                              style={{
                                ...ghostBtn,
                                padding: '4px 10px',
                                fontSize: '11px',
                                color: '#ef4444',
                                borderColor: 'rgba(239,68,68,0.3)',
                                opacity: deleting ? 0.5 : 1,
                              }}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              style={{ ...ghostBtn, padding: '4px 10px', fontSize: '11px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => prefillFollowUp(msg)}
                              style={{ ...ghostBtn, padding: '4px 10px', fontSize: '11px' }}
                            >
                              Follow-up
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(msg.id)}
                              disabled={deleting}
                              style={{
                                ...ghostBtn,
                                padding: '4px 10px',
                                fontSize: '11px',
                                color: '#ef4444',
                                borderColor: 'rgba(239,68,68,0.3)',
                                opacity: deleting ? 0.5 : 1,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
