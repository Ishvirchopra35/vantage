import SkeletonLoader from '@/components/ui/SkeletonLoader'

export default function Loading() {
  return (
    <div className="dashboard-page" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div>
        <SkeletonLoader width={160} height={24} />
        <div style={{ marginTop: '10px' }}>
          <SkeletonLoader width={320} height={14} />
        </div>
      </div>

      {/* Selector row (two select blocks) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        <SkeletonLoader height={44} />
        <SkeletonLoader height={44} />
      </div>

      {/* Score summary card */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
          padding: '20px 24px',
        }}
      >
        {/* Large score block */}
        <div style={{ marginBottom: '20px' }}>
          <SkeletonLoader width={120} height={56} />
        </div>

        {/* 4 sub-score line blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonLoader height={16} />
          <SkeletonLoader height={16} />
          <SkeletonLoader height={16} />
          <SkeletonLoader height={16} />
        </div>
      </div>

      {/* History list (3-4 rows) */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <SkeletonLoader height={52} />
        <SkeletonLoader height={52} />
        <SkeletonLoader height={52} />
        <SkeletonLoader height={52} />
      </div>
    </div>
  )
}
