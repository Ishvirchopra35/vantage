'use client'

// Billing page actions: upgrade checkout, Stripe portal, self-serve refund.
import { useState } from 'react'
import Spinner from '@/components/ui/Spinner'

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: 'var(--radius)',
  padding: '10px 18px',
  fontSize: '13px',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  flexShrink: 0,
}

export function UpgradeButton() {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST', credentials: 'include' })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        console.error('Checkout failed:', json)
        setLoading(false)
        return
      }
      window.location.href = json.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleUpgrade()}
      disabled={loading}
      className="btn-gold-hover"
      style={{ ...btnBase, background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-border)', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      {loading && <Spinner size="sm" />}
      {loading ? 'Redirecting…' : 'Upgrade'}
    </button>
  )
}

// Self-serve refund inside the money-back window. Confirms first (it also
// cancels the subscription), then reloads so the page shows the free plan.
export function RefundButton() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function handleRefund() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/stripe/refund', { method: 'POST', credentials: 'include' })
      const json = await res.json() as { message?: string; error?: string }
      if (!res.ok) {
        setIsError(true)
        setMessage(json.error ?? 'Refund failed. Please contact support.')
        setLoading(false)
        setConfirming(false)
        return
      }
      setIsError(false)
      setMessage(json.message ?? 'Refunded.')
      setTimeout(() => window.location.reload(), 2500)
    } catch {
      setIsError(true)
      setMessage('Network error. Please try again.')
      setLoading(false)
      setConfirming(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
      {confirming ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Refund your last payment and cancel Pro?</span>
          <button
            type="button"
            onClick={() => void handleRefund()}
            disabled={loading}
            style={{ ...btnBase, padding: '7px 14px', background: 'rgba(239,68,68,0.1)', color: 'var(--score-red)', border: '1px solid rgba(239,68,68,0.3)', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading && <Spinner size="sm" />}
            {loading ? 'Refunding…' : 'Yes, refund me'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={loading}
            style={{ ...btnBase, padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            Keep Pro
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{ ...btnBase, padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          Request refund
        </button>
      )}
      {message && (
        <span style={{ fontSize: '12px', color: isError ? 'var(--score-red)' : 'var(--score-green)', maxWidth: '320px', textAlign: 'right' }}>
          {message}
        </span>
      )}
    </div>
  )
}

export function ManageButton() {
  const [loading, setLoading] = useState(false)

  async function handleManage() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', credentials: 'include' })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        console.error('Portal failed:', json)
        setLoading(false)
        return
      }
      window.location.href = json.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleManage()}
      disabled={loading}
      style={{ ...btnBase, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      {loading && <Spinner size="sm" />}
      {loading ? 'Redirecting…' : 'Manage subscription'}
    </button>
  )
}
