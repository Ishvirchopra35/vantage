'use client'

// Billing page actions: upgrade checkout and Stripe portal.
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
