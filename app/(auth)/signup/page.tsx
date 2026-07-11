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

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checkingSession, setCheckingSession] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (data.session) {
        router.replace('/dashboard');
        return;
      }

      setCheckingSession(false);
    };

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  if (checkingSession) {
    return null;
  }

  const validateForm = () => {
    setValidationError('');

    if (!fullName || !email || !password || !confirmPassword) {
      setValidationError('All fields are required');
      return false;
    }

    if (!email.includes('@')) {
      setValidationError('Email must contain @');
      return false;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return false;
    }

    if (!agreedToTerms) {
      setValidationError('You need to agree to the Terms of Service to create an account');
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setError('');
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            // Stored on the auth user for later use. Marketing emails are
            // not sent yet - when that ships, read marketing_opt_in from
            // user metadata (or migrate it to a profiles column) to build
            // the mailing list. terms_accepted_at records consent time.
            marketing_opt_in: marketingOptIn,
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (signUpError) {
        console.error('[signup] sign-up failed:', signUpError);
        setError(
          /already|registered|exists/i.test(signUpError.message)
            ? 'An account with this email already exists. Try signing in instead.'
            : 'We could not create your account. Please try again.'
        );
        setLoading(false);
        return;
      }

      router.push('/dashboard/profile?new=true');
    } catch (e) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleSignUp();
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

        {/* Heading */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          Create your account
        </h1>

        {/* Full Name */}
        <input
          type="text"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={INPUT_STYLE}
        />

        {/* Email */}
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

        {/* Password */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
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

        {/* Confirm Password */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={INPUT_WITH_TOGGLE_STYLE}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
            <EyeIcon open={showConfirmPassword} />
          </button>
        </div>

        {/* Agreements */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
            cursor: 'pointer',
            marginTop: 4,
            marginBottom: 10,
          }}
        >
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--gold)', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" target="_blank" style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
              Privacy Policy
            </Link>
          </span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
            cursor: 'pointer',
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--gold)', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
          />
          <span>Send me occasional emails about new features and job search tips (optional)</span>
        </label>

        {/* Submit */}
        <button
          onClick={handleSignUp}
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
              Creating account...
            </span>
          ) : (
            'Sign up'
          )}
        </button>

        {/* Validation error */}
        {validationError && (
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
            {validationError}
          </div>
        )}

        {/* Server error */}
        {error && (
          <div
            style={{
              marginTop: 12,
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

        {/* Sign in link */}
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 16 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--text)', fontWeight: 500, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
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
