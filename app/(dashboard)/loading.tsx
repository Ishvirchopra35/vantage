import type { CSSProperties } from 'react';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

// Generic group-level fallback skeleton for the (dashboard) route group.
//
// Next.js renders the *nearest* loading boundary for a segment, so any route
// that ships its own `loading.tsx` (e.g. jobs, tracker, interview) always wins
// for its own segment — this file only catches future (dashboard) routes that
// lack their own skeleton, letting them degrade gracefully.
//
// Intentionally generic: a header block + a 4-up card grid + one stacked list
// card. No session / first-entry logic (Requirement 2.6) — the framework's
// loading boundary drives everything. Decorative only: the wrapper is
// aria-hidden and SkeletonLoader is already aria-hidden (Requirements 2.4, 3.4).

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '16px',
  marginBottom: '24px',
};

const cardStyle: CSSProperties = {
  background: 'var(--card-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '20px 24px',
};

const listCardStyle: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '20px 24px',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-subtle)',
};

function CardSkeleton(): React.ReactElement {
  return (
    <div style={cardStyle}>
      <SkeletonLoader width={72} height={28} />
      <div style={{ marginTop: '10px' }}>
        <SkeletonLoader width="70%" height={12} />
      </div>
    </div>
  );
}

export default function Loading(): React.ReactElement {
  const rows = 4;

  return (
    <div className="dashboard-page" aria-hidden="true">
      {/* Header block (title + subtitle) */}
      <div style={{ marginBottom: '24px' }}>
        <SkeletonLoader width={200} height={24} />
        <div style={{ marginTop: '8px' }}>
          <SkeletonLoader width={320} height={14} />
        </div>
      </div>

      {/* 4-up card grid (auto-fit so it collapses gracefully at any width) */}
      <div style={cardGridStyle}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Stacked list card */}
      <div style={listCardStyle}>
        <div style={{ marginBottom: '16px' }}>
          <SkeletonLoader width={150} height={12} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              style={
                index === rows - 1 ? { ...rowStyle, borderBottom: 'none' } : rowStyle
              }
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <SkeletonLoader width="55%" height={14} />
                <div style={{ marginTop: '6px' }}>
                  <SkeletonLoader width="35%" height={12} />
                </div>
              </div>
              <SkeletonLoader width={64} height={22} borderRadius={999} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
