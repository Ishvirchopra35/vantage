import SkeletonLoader from '@/components/ui/SkeletonLoader'

const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '24px',
  marginBottom: '16px',
}

export default function Loading() {
  return (
    <div className="dashboard-page" aria-hidden="true">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <SkeletonLoader width={120} height={24} />
        <div style={{ marginTop: '8px' }}>
          <SkeletonLoader width={200} height={14} />
        </div>
      </div>

      {/* Current plan card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {/* name block */}
            <div style={{ marginBottom: '8px' }}>
              <SkeletonLoader width={140} height={18} />
            </div>
            {/* badge block */}
            <SkeletonLoader width={90} height={14} />
          </div>
          {/* button block */}
          <SkeletonLoader width={120} height={38} borderRadius={8} />
        </div>
      </div>

      {/* Monthly usage card */}
      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <div style={{ marginBottom: '20px' }}>
          <SkeletonLoader width={140} height={16} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}
          >
            {/* label block */}
            <div style={{ flex: 1 }}>
              <SkeletonLoader width={140} height={13} />
            </div>
            {/* bar block */}
            <div style={{ flex: 2, margin: '0 16px' }}>
              <SkeletonLoader width="100%" height={4} borderRadius={2} />
            </div>
            {/* count block */}
            <div style={{ minWidth: '40px', display: 'flex', justifyContent: 'flex-end' }}>
              <SkeletonLoader width={40} height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
