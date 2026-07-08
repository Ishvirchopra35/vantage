import SkeletonLoader from '@/components/ui/SkeletonLoader'

export default function Loading() {
  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      <div className="dashboard-page" aria-hidden="true">
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <SkeletonLoader width={140} height={24} />
          <div style={{ marginTop: '10px' }}>
            <SkeletonLoader width={300} height={14} />
          </div>
        </div>

        {/* Report / locked-state card */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            padding: '48px 40px',
          }}
        >
          {/* Large title block */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <SkeletonLoader width={320} height={48} />
          </div>

          {/* Paragraph line blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '520px', margin: '0 auto' }}>
            <SkeletonLoader height={16} />
            <SkeletonLoader height={16} />
            <SkeletonLoader width="90%" height={16} />
            <SkeletonLoader width="75%" height={16} />
          </div>

          {/* Progress bar block */}
          <div style={{ maxWidth: '320px', margin: '32px auto 0' }}>
            <SkeletonLoader height={6} borderRadius={999} />
          </div>
        </div>
      </div>
    </div>
  )
}
