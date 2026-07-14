import PageHeader from '@/components/ui/PageHeader'
import ResumeStudio from '@/components/ResumeStudio'

// Experimental feature, listed in the sidebar with an "Experimental" badge.
// If it earns its keep it will be paired with the Tailor + ATS flow.
export const metadata = {
  title: 'Resume Studio - Vantage',
  description: 'Fine-tune your base or tailored resume by telling the AI what to change.',
  robots: { index: false },
}

export default function ResumeStudioPage(): React.ReactElement {
  return (
    <div className="dashboard-page">
      <PageHeader
        title="Resume Studio"
        subtitle="Open a tailored or uploaded resume, tell the AI what to change, download the PDF."
        action={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--muted)',
            }}
          >
            Experimental
          </span>
        }
      />
      <ResumeStudio />
    </div>
  )
}
