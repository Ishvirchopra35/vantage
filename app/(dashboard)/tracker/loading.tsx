import SkeletonLoader from '@/components/ui/SkeletonLoader'

// Route-transition skeleton for /tracker. Mirrors the page's own loading
// branch: header + button, a `tracker-stats-grid` of 4 stat cards, and a
// table card with 5 row placeholders. Decorative only (aria-hidden).
const card = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '24px',
}

export default function Loading() {
  return (
    <div className="dashboard-page" aria-hidden="true">
      {/* -- Header (title + subtitle left, button right) ----------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonLoader width={200} height={24} />
          <SkeletonLoader width={260} height={14} />
        </div>
        <SkeletonLoader width={150} height={44} />
      </div>

      {/* -- Stats grid (mirrors tracker-stats-grid) ---------------------- */}
      <div className="tracker-stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLoader key={i} height={76} />
        ))}
      </div>

      {/* -- Table card with row placeholders ----------------------------- */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonLoader key={i} height={52} />
        ))}
      </div>
    </div>
  )
}
