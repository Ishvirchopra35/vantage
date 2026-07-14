'use client';

// Dismissible card pointing users at the /feedback page. Dismissing hides
// it for 7 days, then it resurfaces. Renders nothing until mounted so the
// dismissed state never flashes on hydration.
import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'vantage-feedback-nudge-dismissed-at';
const RESURFACE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export default function FeedbackNudge(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(STORAGE_KEY));
      // Not a valid timestamp (never dismissed, or the old '1' flag from the
      // one-time version) or the 7 days are up: show it again.
      if (!Number.isFinite(dismissedAt) || Date.now() - dismissedAt > RESURFACE_AFTER_MS) {
        setVisible(true);
      }
    } catch {
      // Storage unavailable (private mode): keep the nudge hidden.
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Best effort; hiding for this session is enough.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        padding: '14px 18px',
        marginBottom: '20px',
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ minWidth: '260px', flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
          Found a bug? Missing a feature?
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
          Tell us on the feedback page. Every message goes straight to the founder.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <Link
          href="/feedback"
          className="btn-gold-hover"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 14px',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Share feedback
        </Link>
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
    </div>
  );
}
