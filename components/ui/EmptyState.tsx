'use client';

import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  actionOnClick,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        padding: '24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '400px',
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          style={{
            margin: '0 auto 24px',
            opacity: 0.6,
          }}
        >
          <rect
            x="12"
            y="12"
            width="40"
            height="40"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <line x1="20" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="2" />
          <line x1="20" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="2" />
          <line x1="20" y1="40" x2="35" y2="40" stroke="currentColor" strokeWidth="2" />
        </svg>

        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '8px',
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--muted)',
            marginBottom: actionLabel ? '24px' : 0,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>

        {actionLabel && (
          actionHref ? (
            <Link
              href={actionHref}
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                backgroundColor: 'var(--accent)',
                color: 'var(--bg)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '0.95rem',
                fontWeight: 600,
                transition: 'opacity 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
              }}
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={actionOnClick}
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
              {actionLabel}
            </button>
          )
        )}
      </div>
    </div>
  );
}
