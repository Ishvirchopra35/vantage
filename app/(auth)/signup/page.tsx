'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

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

    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
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
    if (e.key === 'Enter' && !loading && validationError === '') {
      handleSignUp();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div
        className="w-full max-w-sm"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '40px 32px',
        }}
      >
        {/* Wordmark */}
        <h1 className="text-center text-2xl font-bold mb-10" style={{ color: 'var(--text)' }}>
          Vantage
        </h1>

        {/* Heading */}
        <h2 className="text-xl font-semibold mb-8" style={{ color: 'var(--text)' }}>
          Create your account
        </h2>

        {/* Full Name Input */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 12px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Email Input */}
        <div className="mb-5">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Password Input */}
        <div className="mb-5 relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
              paddingRight: '44px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: 'var(--muted)' }}
            >
              {showPassword ? (
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
          </button>
        </div>

        {/* Confirm Password Input */}
        <div className="mb-8 relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
              paddingRight: '44px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: 'var(--muted)' }}
            >
              {showConfirmPassword ? (
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
          </button>
        </div>

        {/* Sign Up Button */}
        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full font-medium text-sm transition-opacity"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#000',
            borderRadius: '10px',
            padding: '12px 16px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" opacity="1" />
              </svg>
              Creating account...
            </span>
          ) : (
            'Sign up'
          )}
        </button>

        {/* Validation Error */}
        {validationError && (
          <div
            className="mt-6 p-4 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            {validationError}
          </div>
        )}

        {/* Server Error */}
        {error && (
          <div
            className="mt-4 p-4 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {/* Sign In Link */}
        <p className="text-center text-sm mt-8" style={{ color: 'var(--muted)' }}>
          Already have an account?{' '}
          <Link href="/login" className="underline" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
