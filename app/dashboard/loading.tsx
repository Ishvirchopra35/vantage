import type { CSSProperties } from 'react';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

// Route skeleton for the dashboard landing (/dashboard). Mirrors the real page's
// structure — greeting header, 4-up stats grid, and stacked list/section cards —
// so the loading boundary does not cause a jarring layout shift.
// Decorative only: the wrapper is aria-hidden and SkeletonLoader is already aria-hidden.

const statCardStyle: CSSProperties = {
  background: 'var(--card-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '20px 24px',
};

const sectionCardStyle: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '20px 24px',
  marginBottom: '16px',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-subtle)',
};

function StatCardSkeleton(): React.ReactElement {
  return (
    <div style={statCardStyle}>
      <SkeletonLoader width={72} height={32} />
      <div style={{ marginTop: '10px' }}>
        <SkeletonLoader width={120} height={12} />
      </div>
    </div>
  );
}

function ListCardSkeleton({
  rows,
  last = false,
}: {
  rows: number;
  last?: boolean;
}): React.ReactElement {
  return (
    <div style={last ? { ...sectionCardStyle, marginBottom: 0 } : sectionCardStyle}>
      {/* Section header (title + "view all") */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <SkeletonLoader width={150} height={12} />
        <SkeletonLoader width={56} height={12} />
      </div>

      {/* List rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} style={index === rows - 1 ? { ...rowStyle, borderBottom: 'none' } : rowStyle}>
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
  );
}

export default function Loading(): React.ReactElement {
  return (
    <div aria-hidden="true">
      {/* Greeting header (title + subtitle) */}
      <div style={{ marginBottom: '24px' }}>
        <SkeletonLoader width={260} height={28} />
        <div style={{ marginTop: '6px' }}>
          <SkeletonLoader width={340} height={14} />
        </div>
      </div>

      {/* 4-up stats grid */}
      <div className="stats-grid">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Two stacked list/section cards */}
      <ListCardSkeleton rows={4} />
      <ListCardSkeleton rows={3} last />
    </div>
  );
}
