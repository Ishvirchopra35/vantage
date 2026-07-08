import SkeletonLoader from '@/components/ui/SkeletonLoader'

// Route-transition skeleton for /interview. Mirrors the page's own `loading`
// branch: header, one large "start session" card, and 3 stacked session rows.
export default function Loading() {
  return (
    <div className="dashboard-page" aria-hidden="true">
      <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SkeletonLoader width={220} height={26} />
        <SkeletonLoader width={340} height={14} />
      </div>
      <SkeletonLoader height={170} />
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3].map(i => (
          <SkeletonLoader key={i} height={64} />
        ))}
      </div>
    </div>
  )
}
