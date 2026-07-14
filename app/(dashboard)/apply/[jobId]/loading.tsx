import SkeletonLoader from '@/components/ui/SkeletonLoader';

// Card + section-label shapes mirror the real detail page (app/(dashboard)/apply/[jobId]/page.tsx).
const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '20px 24px',
  marginBottom: '16px',
};

export default function Loading(): React.ReactElement {
  return (
    <div className="dashboard-page" aria-hidden="true">
      {/* -- Header (back link + title + status pill) ---------------------- */}
      <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SkeletonLoader width={90} height={12} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SkeletonLoader width={380} height={26} />
          <SkeletonLoader width={90} height={20} borderRadius="var(--radius-sm)" />
        </div>
      </div>

      {/* -- Application Kit (section label + 3-col grid of kit cards) ------ */}
      <div style={card}>
        <div style={{ marginBottom: '14px' }}>
          <SkeletonLoader width={130} height={11} />
        </div>
        <div className="rsp-grid-3" style={{ gap: '14px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLoader key={i} height={120} borderRadius="10px" />
          ))}
        </div>
      </div>

      {/* -- Application Questions (label + input + button) ---------------- */}
      <div style={card}>
        <div style={{ marginBottom: '14px' }}>
          <SkeletonLoader width={160} height={11} />
        </div>
        <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonLoader width={220} height={12} />
          <SkeletonLoader height={72} borderRadius="8px" />
        </div>
        <SkeletonLoader width={150} height={38} />
      </div>

      {/* -- Auto-fill ----------------------------------------------------- */}
      <div style={card}>
        <div style={{ marginBottom: '14px' }}>
          <SkeletonLoader width={80} height={11} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <SkeletonLoader width="70%" height={14} />
          <SkeletonLoader width={220} height={38} />
        </div>
      </div>

      {/* -- Submit Checklist (label + 5 rows) ----------------------------- */}
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={{ marginBottom: '14px' }}>
          <SkeletonLoader width={130} height={11} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} height={40} />
          ))}
        </div>
      </div>
    </div>
  );
}
