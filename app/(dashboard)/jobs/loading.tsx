import SkeletonLoader from '@/components/ui/SkeletonLoader'

// Route-transition skeleton for /jobs. Mirrors the in-page `jobs-grid`
// skeleton: header row + button, a full-width filter bar, and a 2-col
// grid of 4 job-card placeholders. Decorative only (aria-hidden).
export default function Loading() {
  return (
    <div className="dashboard-page" aria-hidden="true">
      {/* -- Header row (title + subtitle left, button right) -------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonLoader width={180} height={24} />
          <SkeletonLoader width={300} height={14} />
        </div>
        <SkeletonLoader width={120} height={40} />
      </div>

      {/* -- Filter bar --------------------------------------------------- */}
      <div style={{ marginBottom: '16px' }}>
        <SkeletonLoader height={60} borderRadius={10} />
      </div>

      {/* -- Job-card grid (2-col, matches page's jobs-grid) -------------- */}
      <div className="jobs-loading-grid">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLoader key={i} height={180} />
        ))}
      </div>

      <style>{`
        .jobs-loading-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        @media (max-width: 640px) {
          .jobs-loading-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
