import SkeletonLoader from '@/components/ui/SkeletonLoader'

function SettingsSection({ withDivider }: { withDivider?: boolean }) {
  return (
    <div
      style={
        withDivider
          ? { borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }
          : undefined
      }
    >
      {/* section title */}
      <div style={{ marginBottom: '16px' }}>
        <SkeletonLoader width={110} height={14} />
      </div>
      {/* field-row blocks */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '6px' }}>
          <SkeletonLoader width={70} height={12} />
        </div>
        <SkeletonLoader width="100%" height={38} borderRadius={8} />
      </div>
      <div>
        <div style={{ marginBottom: '6px' }}>
          <SkeletonLoader width={90} height={12} />
        </div>
        <SkeletonLoader width={180} height={38} borderRadius={8} />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }} aria-hidden="true">
      <div className="dashboard-page">
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            padding: '32px',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <SkeletonLoader width={140} height={24} />
          </div>

          {/* Stacked settings sections */}
          <SettingsSection />
          <SettingsSection withDivider />
          <SettingsSection withDivider />
        </div>
      </div>
    </div>
  )
}
