'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

const INPUT_WITH_TOGGLE_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  paddingRight: 40,
  marginBottom: 0,
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  // The recovery link runs through /auth/callback, which exchanges the code
  // for a session before forwarding here. If that session is missing the link
  // was invalid or expired, so we show a recovery message instead of the form.
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setHasSession(!!data.user);
      setChecking(false);
    };

    void check();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  if (checking) {
    return null;
  }

  const handleSubmit = async () => {
    setError('');

    if (!password || !confirmPassword) {
      setError('Enter and confirm your new password');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      console.error('[reset-password] update failed:', updateError);
      setError('We could not update your password. The link may have expired - request a new one.');
      setLoading(false);
      return;
    }

    // Session already reflects the new credential. Refresh server components,
    // then land on the dashboard.
    router.refresh();
    router.push('/dashboard');
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

        {!hasSession ? (
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
              Link expired
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              This password reset link is invalid or has expired. Request a new one and try again.
            </p>
            <Link
              href="/forgot-password"
              className="ds-btn-primary btn-gold-hover"
              style={{
                display: 'block',
                textAlign: 'center',
                width: '100%',
                padding: 12,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Request a new link
            </Link>
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
              Set a new password
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Choose a new password for your account.
            </p>

            {/* Password */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={INPUT_WITH_TOGGLE_STYLE}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Confirm */}
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Updating...
                </span>
              ) : (
                'Update password'
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
          </>
        )}
      </div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );
}
