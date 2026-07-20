'use client'

// After-success feedback prompt, heavily rate limited so it never nags.
// It renders only when all of these hold:
//   - the user has completed at least 3 successful feature actions
//     (pages report those via recordFeatureSuccess)
//   - it has not been shown in the last 14 days
//   - the dashboard feedback card (components/FeedbackNudge.tsx) was not
//     dismissed in the last 7 days - both prompts share the same
//     dismissed-at key, so the two never stack.
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Same key FeedbackNudge writes on dismiss.
const DISMISSED_KEY = 'vantage-feedback-nudge-dismissed-at'
const SUCCESS_COUNT_KEY = 'vantage-feature-success-count'
const LAST_SHOWN_KEY = 'vantage-feature-nudge-shown-at'

const MIN_SUCCESSES = 3
const SHOW_EVERY_MS = 14 * 24 * 60 * 60 * 1000
const RESPECT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000

// Call after every successful feature action (job parsed, resume tailored,
// cover letter generated, ...). Cheap and safe to call often.
export function recordFeatureSuccess(): void {
  try {
    const count = Number(localStorage.getItem(SUCCESS_COUNT_KEY)) || 0
    localStorage.setItem(SUCCESS_COUNT_KEY, String(count + 1))
  } catch {
    // Storage unavailable (private mode): the nudge simply never shows.
  }
}

export default function FeatureFeedbackNudge(): React.ReactElement | null {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const count = Number(localStorage.getItem(SUCCESS_COUNT_KEY)) || 0
      if (count < MIN_SUCCESSES) return

      const lastShown = Number(localStorage.getItem(LAST_SHOWN_KEY))
      if (Number.isFinite(lastShown) && Date.now() - lastShown < SHOW_EVERY_MS) return

      const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY))
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < RESPECT_DISMISS_MS) return

      // Mark as shown immediately so revisiting the page does not re-show it.
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()))
      setVisible(true)
    } catch {
      // Storage unavailable: keep it hidden.
    }
  }, [])

  const dismiss = () => {
    try {
      // Quiet the dashboard card too - one dismissal silences both prompts.
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // Best effort; hiding for this session is enough.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        marginTop: '16px',
        padding: '10px 14px',
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
      }}
    >
      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
        How did that go?{' '}
        <Link
          href="/feedback"
          style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          Report a bug or request a feature
        </Link>
        . It goes straight to the founder.
      </span>
      <button
        type="button"
        onClick={dismiss}
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
    </div>
  )
}
