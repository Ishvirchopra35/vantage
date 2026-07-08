'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the real error; the UI only ever shows a friendly message in production.
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
          }}
        >
          Something went wrong
        </h1>

        {process.env.NODE_ENV === 'development' && (
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--muted)',
              marginBottom: '32px',
              fontFamily: 'monospace',
              padding: '12px',
              backgroundColor: 'var(--card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              wordBreak: 'break-word',
            }}
          >
            {error.message}
          </p>
        )}

        <button
          onClick={reset}
          style={{
            padding: '10px 24px',
            backgroundColor: 'var(--accent)',
            color: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
