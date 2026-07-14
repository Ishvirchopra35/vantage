'use client'

// Admin-only: type-to-confirm reset of the analytics tables shown on /admin
// (events + route_logs). Refreshes the dashboard after a successful wipe.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'

const CONFIRM_WORD = 'RESET ANALYTICS'

export default function AdminResetAnalytics(): React.ReactElement {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/reset-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Reset failed')
        return
      }
      setResult(`Cleared ${json.eventsDeleted} events and ${json.routeLogsDeleted} route logs.`)
      setInput('')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px', lineHeight: 1.6 }}>
        Clears the events and route logs behind the usage, retention, and performance numbers on
        this page. User accounts, applications, and scores are not touched. This cannot be undone.
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Type ${CONFIRM_WORD}`}
          style={{
            width: '220px',
            padding: '9px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={busy || input !== CONFIRM_WORD}
          style={{
            padding: '8px 16px',
            background: input === CONFIRM_WORD && !busy ? 'rgba(239,68,68,0.15)' : 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-sm)',
            color: input === CONFIRM_WORD ? 'var(--score-red)' : 'rgba(239,68,68,0.4)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: busy || input !== CONFIRM_WORD ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {busy && <Spinner size="sm" />}
          Reset analytics
        </button>
      </div>
      {result && <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text)' }}>{result}</div>}
      {error && <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--score-red)' }}>{error}</div>}
    </div>
  )
}
