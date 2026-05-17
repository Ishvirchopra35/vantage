'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageType = 'connection_request' | 'cold_email' | 'follow_up'

interface Contact {
  name: string
  title: string
  company: string
  linkedin_url: string | null
  relevance_reason: string
  job_relevance_score?: number
}

interface Job {
  id: string
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
  generated_message: string
  user_edited_message: string | null
  sent: boolean
  sent_at: string | null
  job_id: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Card ─────────────────────────────────────────────────────────────────────

function ContactCard({ contact, onUse }: { contact: Contact; onUse: (c: Contact) => void }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
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
          {contact.title} · {contact.company}
        </div>
      </div>
      {contact.relevance_reason && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
          {contact.relevance_reason}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {contact.linkedin_url && (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              textDecoration: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 10px',
            }}
          >
            LinkedIn ↗
          </a>
        )}
        <button
          type="button"
          onClick={() => onUse(contact)}
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--bg)',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '6px',
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkingPage() {
  const supabase = createClient()

  // Section 1 — Find contacts
  const [searchCompany, setSearchCompany] = useState('')
  const [searchRole, setSearchRole] = useState('')
  const [searching, setSearching] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchDone, setSearchDone] = useState(false)

  // Section 2 — Generate message
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactCompany, setContactCompany] = useState('')
  const [contactLinkedinUrl, setContactLinkedinUrl] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('connection_request')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [savedRow, setSavedRow] = useState<OutreachMessage | null>(null)
  const [savingEdits, setSavingEdits] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const generateSectionRef = useRef<HTMLDivElement>(null)

  // Section 3 — Tracker
  const [messages, setMessages] = useState<OutreachMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  // Load jobs and messages on mount
  useEffect(() => {
    void loadJobs()
    void loadMessages()
  }, [])

  async function loadJobs() {
    const { data } = await supabase
      .from('jobs')
      .select('id, title, company')
      .order('created_at', { ascending: false })
      .limit(30)
    setJobs((data ?? []) as Job[])
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
    setContactLinkedinUrl(contact.linkedin_url ?? '')
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
    setSelectedJobId(msg.job_id ?? '')
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
    setSearchDone(false)

    const res = await fetch('/api/find-contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: searchCompany.trim(), role: searchRole.trim() || undefined }),
    })
    const json = await res.json()

    if (!res.ok) {
      setSearchError(json.error ?? 'Search failed')
    } else {
      setContacts(json.contacts ?? [])
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

    const res = await fetch('/api/generate-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: contactName.trim(),
        contactTitle: contactTitle.trim(),
        contactCompany: contactCompany.trim(),
        contactLinkedinUrl: contactLinkedinUrl.trim() || undefined,
        messageType,
        jobId: selectedJobId || undefined,
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      setGenerateError(json.error ?? 'Generation failed')
    } else {
      const msg = json.message as OutreachMessage
      setGeneratedText(msg.generated_message)
      setEditedText(msg.generated_message)
      setSavedRow(msg)
      setMessages(prev => [msg, ...prev])
    }
    setGenerating(false)
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

  async function handleDelete(msg: OutreachMessage) {
    if (!window.confirm(`Delete message to ${msg.contact_name}?`)) return
    setDeletingIds(prev => new Set([...prev, msg.id]))
    await supabase.from('outreach_messages').delete().eq('id', msg.id)
    setMessages(prev => prev.filter(m => m.id !== msg.id))
    setDeletingIds(prev => { const s = new Set(prev); s.delete(msg.id); return s })
  }

  // ── Shared styles ────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '20px',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '16px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '6px',
  }

  const primaryBtn: React.CSSProperties = {
    background: 'var(--accent)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 20px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  const ghostBtn: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
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
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Networking</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Find contacts and generate personalised outreach messages</div>
      </div>

      {/* ── Section 1: Find contacts ──────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>1 · Find contacts</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Company</label>
            <input
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
            <input
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
            No contacts found. Try a broader role or different company spelling.
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

      {/* ── Section 2: Generate message ───────────────────────────────────── */}
      <div style={card} ref={generateSectionRef}>
        <div style={sectionTitle}>2 · Generate message</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Contact name</label>
            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input type="text" value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Senior Recruiter" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input type="text" value={contactCompany} onChange={e => setContactCompany(e.target.value)} placeholder="Shopify" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>LinkedIn URL (optional)</label>
            <input type="text" value={contactLinkedinUrl} onChange={e => setContactLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Message type</label>
            <select
              value={messageType}
              onChange={e => setMessageType(e.target.value as MessageType)}
              style={{ ...inputStyle }}
            >
              <option value="connection_request">LinkedIn connection request</option>
              <option value="cold_email">Cold email</option>
              <option value="follow_up">Follow-up</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Job (optional)</label>
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              style={{ ...inputStyle }}
            >
              <option value="">No specific job</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title} — {j.company}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating || !contactName.trim() || !contactCompany.trim()}
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
          </div>
        )}
      </div>

      {/* ── Section 3: Tracker ────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>3 · Outreach tracker</div>

        {loadingMessages ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <Spinner size="md" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '13px', color: 'var(--muted)' }}>
            No outreach messages yet. Generate one above to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
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
                {messages.map(msg => {
                  const displayText = msg.user_edited_message ?? msg.generated_message
                  const toggling = togglingIds.has(msg.id)
                  const deleting = deletingIds.has(msg.id)
                  return (
                    <tr key={msg.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 12px 12px 0', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {msg.contact_linkedin_url ? (
                          <a href={msg.contact_linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                            {msg.contact_name} ↗
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
                            onClick={() => void handleDelete(msg)}
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
