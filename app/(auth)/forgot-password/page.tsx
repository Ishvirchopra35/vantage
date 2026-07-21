'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: 14,
  marginBottom: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (!email || !email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    // Sends a recovery link. The link's code is exchanged by /auth/callback,
    // which then forwards to /reset-password with an active session. This works
    // even for Google-only accounts - setting a password adds a password
    // identity, giving them a second way to sign in.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      console.error('[forgot-password] reset request failed:', resetError);
      setError('We could not send the reset email. Please try again.');
      setLoading(false);
      return;
    }

    // Always show the same confirmation so this cannot be used to probe which
    // emails have accounts.
    setSent(true);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleSubmit();
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '0 0 0 3px var(--gold-dim)';
    e.currentTarget.style.borderColor = 'var(--gold-border)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.borderColor = 'var(--border)';
  };

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 32,
          width: '100%',
          maxWidth: 400,
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text)',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          Vantage
        </div>

        {sent ? (
          <>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 12,
                textAlign: 'left',
              }}
            >
              Check your email
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              If an account exists for <strong style={{ color: 'var(--text)' }}>{email}</strong>,
              we&apos;ve sent a link to reset your password. Open it on this device and you&apos;ll
              be able to set a new one.
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              <Link href="/login" style={{ color: 'var(--text)', fontWeight: 500, textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 12,
                textAlign: 'left',
              }}
            >
              Reset your password
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Enter your email and we&apos;ll send you a link to set a new password.
            </p>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={INPUT_STYLE}
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="ds-btn-primary btn-gold-hover"
              style={{
                width: '100%',
                padding: 12,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send reset link'
              )}
            </button>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: 'var(--score-red)',
                }}
              >
                {error}
              </div>
            )}

            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 16 }}>
              Remembered it?{' '}
              <Link href="/login" style={{ color: 'var(--text)', fontWeight: 500, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
