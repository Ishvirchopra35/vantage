import SkeletonLoader from '@/components/ui/SkeletonLoader'

export default function Loading() {
  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      <div className="dashboard-page" aria-hidden="true">
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <SkeletonLoader width={240} height={24} />
          <div style={{ marginTop: '10px' }}>
            <SkeletonLoader width={420} height={14} />
          </div>
        </div>

        {/* URL / paste input row (input + button) */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
          <div style={{ flex: 1 }}>
            <SkeletonLoader height={46} />
          </div>
          <SkeletonLoader width={130} height={46} />
        </div>

        {/* Job preview / results card */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            padding: '24px',
            marginTop: '20px',
          }}
        >
          {/* Title block */}
          <div style={{ marginBottom: '8px' }}>
            <SkeletonLoader width={260} height={20} />
          </div>
          <SkeletonLoader width={180} height={14} />

          {/* Line blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            <SkeletonLoader height={16} />
            <SkeletonLoader height={16} />
            <SkeletonLoader width="85%" height={16} />
            <SkeletonLoader width="70%" height={16} />
          </div>
        </div>
      </div>
    </div>
  )
}
