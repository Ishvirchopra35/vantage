import SkeletonLoader from '@/components/ui/SkeletonLoader';

export default function Loading(): React.ReactElement {
  return (
    <div className="dashboard-page" aria-hidden="true">
      {/* -- Header (mirrors Auto-apply title + subtitle) ------------------- */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SkeletonLoader width={180} height={24} />
        <SkeletonLoader width={420} height={14} />
      </div>

      {/* -- Application list (dash-card-row stack) ------------------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLoader key={i} height={68} />
        ))}
      </div>
    </div>
  );
}
