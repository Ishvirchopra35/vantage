'use client'

// Shared inline error box with a "Report this bug" link so users can flag
// a failure at the exact moment it happens instead of hunting for the
// feedback page later.
import Link from 'next/link'
import type { CSSProperties } from 'react'

interface ErrorNoticeProps {
  message: string
  style?: CSSProperties
  onDismiss?: () => void
}

export default function ErrorNotice({ message, style, onDismiss }: ErrorNoticeProps): React.ReactElement {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '10px',
        fontSize: '13px',
        textAlign: 'left',
        ...style,
      }}
    >
      <div style={{ color: 'var(--score-red)' }}>{message}</div>
      <div style={{ display: 'flex', gap: '14px', marginTop: '6px' }}>
        <Link
          href="/feedback?type=bug"
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          Report this bug
        </Link>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
