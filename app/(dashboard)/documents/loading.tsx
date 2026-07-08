import SkeletonLoader from '@/components/ui/SkeletonLoader'

export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }} aria-hidden="true">
      <div className="dashboard-page">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <SkeletonLoader width={140} height={24} />
            <div style={{ marginTop: '8px' }}>
              <SkeletonLoader width={280} height={14} />
            </div>
          </div>

          {/* Filter / tab row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <SkeletonLoader width={60} height={30} borderRadius={999} />
            <SkeletonLoader width={130} height={30} borderRadius={999} />
            <SkeletonLoader width={110} height={30} borderRadius={999} />
          </div>

          {/* Stacked list of document cards */}
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <SkeletonLoader width="100%" height={120} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
