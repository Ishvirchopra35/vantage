'use client'

// Admin-only campaign composer for /admin. Sends product-update emails via
// /api/admin/send-campaign. The intended flow is: write, "Send test to me",
// check your inbox, then type SEND to email every opted-in subscriber.
import { useState } from 'react'
import Spinner from '@/components/ui/Spinner'

interface Props {
  optedInCount: number
}

export default function AdminCampaignForm({ optedInCount }: Props): React.ReactElement {
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [confirmWord, setConfirmWord] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [sendingReal, setSendingReal] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = sendingTest || sendingReal
  const canCompose = subject.trim().length > 0 && html.trim().length > 0

  async function send(testOnly: boolean) {
    setError(null)
    setResult(null)
    if (testOnly) setSendingTest(true)
    else setSendingReal(true)
    try {
      const res = await fetch('/api/admin/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), html, testOnly }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Send failed')
        return
      }
      setResult(
        testOnly
          ? `Test sent to your email (${json.sent} sent, ${json.failed} failed).`
          : `Campaign sent: ${json.sent} delivered, ${json.failed} failed.`
      )
      if (!testOnly) setConfirmWord('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSendingTest(false)
      setSendingReal(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
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

  return (
    <div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.6 }}>
        {optedInCount} subscriber{optedInCount === 1 ? '' : 's'} opted in to product updates.
        The body is raw HTML; an unsubscribe footer is appended automatically.
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          maxLength={200}
          placeholder="What's new in Vantage"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Body (HTML)</label>
        <textarea
          value={html}
          onChange={e => setHtml(e.target.value)}
          rows={8}
          placeholder="<p>Hi,</p><p>Here is what shipped this month…</p>"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void send(true)}
          disabled={busy || !canCompose}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: busy || !canCompose ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            opacity: busy || !canCompose ? 0.6 : 1,
          }}
        >
          {sendingTest && <Spinner size="sm" />}
          Send test to me
        </button>

        <input
          type="text"
          value={confirmWord}
          onChange={e => setConfirmWord(e.target.value)}
          placeholder="Type SEND to enable"
          style={{ ...inputStyle, width: '160px' }}
        />
        <button
          type="button"
          onClick={() => void send(false)}
          disabled={busy || !canCompose || confirmWord !== 'SEND'}
          style={{
            padding: '8px 16px',
            background: confirmWord === 'SEND' && canCompose && !busy ? 'var(--btn-primary-bg)' : 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: confirmWord === 'SEND' && canCompose && !busy ? 'var(--btn-primary-text)' : 'var(--muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: busy || !canCompose || confirmWord !== 'SEND' ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {sendingReal && <Spinner size="sm" />}
          Send to {optedInCount} subscriber{optedInCount === 1 ? '' : 's'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text)' }}>{result}</div>
      )}
      {error && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--score-red)' }}>{error}</div>
      )}
    </div>
  )
}
