import SkeletonLoader from '@/components/ui/SkeletonLoader'

// Route-transition skeleton for /networking. Mirrors the real page: a header,
// then three stacked section cards (Find / Generate / Tracker). Each card uses
// the page's own card styling (var(--card), border, radius, shadow-md).
const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '24px',
  marginBottom: '20px',
}

export default function Loading() {
  return (
    <div className="dashboard-page" aria-hidden="true">
      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SkeletonLoader width={200} height={26} />
        <SkeletonLoader width={360} height={14} />
      </div>

      {/* Section 1 · Find contacts */}
      <div style={card}>
        <SkeletonLoader width={140} height={12} />
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <SkeletonLoader height={38} />
          <SkeletonLoader height={38} />
        </div>
        <div style={{ marginTop: '14px' }}>
          <SkeletonLoader width={130} height={38} />
        </div>
      </div>

      {/* Section 2 · Generate message */}
      <div style={card}>
        <SkeletonLoader width={160} height={12} />
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={38} />
          ))}
        </div>
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={38} />
          ))}
        </div>
        <div style={{ marginTop: '16px' }}>
          <SkeletonLoader width={110} height={38} />
        </div>
      </div>

      {/* Section 3 · Outreach tracker */}
      <div style={card}>
        <SkeletonLoader width={150} height={12} />
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={40} />
          ))}
        </div>
      </div>
    </div>
  )
}
